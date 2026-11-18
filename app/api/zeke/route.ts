// Server-side Zeke pipeline per §8: guard → (image) → main turn with tools → create_draft validation.
// The model proposes; deterministic server code resolves and validates. Never trusts the browser or the model.
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { getUsdBalance } from '@/lib/sui/balance';
import { usdRates } from '@/lib/fx.server';
import { formatUsd } from '@/lib/sui/money';
import {
  ilmuChat, extractJson, ZekeUnavailable,
  type ChatMessage, type ToolCall,
} from '@/lib/zeke/ilmu.server';
import {
  ZEKE_TOOLS, ZEKE_SYSTEM_PROMPT, GUARD_SYSTEM_PROMPT, GuardResult, Proposal, ImageFields,
  type Proposal as ProposalT,
} from '@/lib/zeke/schema';
import {
  addressTypedByUser, lookalikeOf, toUsdMinor, URGENCY,
} from '@/lib/zeke/provenance';
import {
  ZEKE_MAX_PER_TX_MINOR, ZEKE_MAX_PER_DAY_MINOR, ZEKE_STEP_UP_ABOVE_MINOR,
  DRAFT_TTL_MS, DUPLICATE_WINDOW_MS, ZEKE_MSGS_PER_HOUR,
} from '@/lib/zeke/caps';
import { canonicalJson, sha256Hex } from '@/lib/sui/walrus.server';
import { NextResponse } from 'next/server';

const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(8),
  image: z.string().max(4_500_000).optional(), // dataUrl ≤ 4MB
});

/** Read tools — server data only. */
async function runTool(name: string, args: Record<string, unknown>, userId: string, suiAddress: string | null): Promise<string> {
  if (name === 'get_balance') {
    if (!suiAddress) return JSON.stringify({ error: 'No wallet yet. Finish onboarding first.' });
    const bal = await getUsdBalance(suiAddress);
    const rates = await usdRates();
    return JSON.stringify({
      usd: formatUsd(bal.total),
      myr: rates.MYR !== null ? (Number(bal.total) / 1e6 * rates.MYR).toFixed(2) : null,
      source: rates.source,
    });
  }
  if (name === 'get_activity') {
    if (!suiAddress) return JSON.stringify({ payments: [] });
    const limit = Math.min(Number(args.limit ?? 10) || 10, 20);
    const rows = await prisma.payment.findMany({
      where: { OR: [{ fromAddress: suiAddress }, { toAddress: suiAddress }] },
      orderBy: { createdAt: 'desc' }, take: limit,
      include: { receipt: { select: { id: true } } },
    });
    return JSON.stringify(rows.map(p => ({
      kind: p.kind, direction: p.fromAddress === suiAddress ? 'out' : 'in',
      usd: formatUsd(p.amountMinor), at: p.createdAt.toISOString(),
      note: p.note ? `UNTRUSTED: ${p.note}` : null, receiptId: p.receipt?.id ?? null,
    })));
  }
  if (name === 'get_allowances') {
    if (!suiAddress) return JSON.stringify({ gives: [], receives: [] });
    const gives = await prisma.allowance.findMany({ where: { funderId: userId, status: 'ACTIVE' } });
    const receives = await prisma.allowance.findMany({ where: { spenderAddress: suiAddress, status: 'ACTIVE' } });
    return JSON.stringify({
      gives: gives.map(a => ({ label: a.spenderLabel, monthlyLimitUsd: formatUsd(a.monthlyLimitMinor), until: a.expiresAt.toISOString() })),
      receives: receives.map(a => ({ name: a.name, monthlyLimitUsd: formatUsd(a.monthlyLimitMinor), until: a.expiresAt.toISOString() })),
    });
  }
  if (name === 'lookup_request') {
    const slug = String(args.slug ?? '');
    const r = await prisma.paymentRequest.findUnique({
      where: { slug },
      include: { payee: { select: { name: true, handle: true } } },
    });
    if (!r) return JSON.stringify({ error: 'Request not found.' });
    return JSON.stringify({
      number: r.number, payeeName: r.payee.name, payeeHandle: r.payee.handle,
      amountUsd: formatUsd(r.amountMinor), description: `UNTRUSTED: ${r.description}`, status: r.status,
    });
  }
  return JSON.stringify({ error: 'Unknown tool.' });
}

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  // 1. Kill switch + rate limit
  if (!u.zekeEnabled) {
    return NextResponse.json({ error: 'Zeke is turned off. Turn it on in Settings.' }, { status: 403 });
  }
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const recent = await prisma.zekeDraft.count({ where: { userId: u.id, createdAt: { gte: hourAgo } } });
  // Simple in-memory limiter fallback: count drafts; messages themselves not persisted (stateless)
  if (recent > ZEKE_MSGS_PER_HOUR * 3) {
    return NextResponse.json({ error: 'Zeke is resting — too many messages this hour.' }, { status: 429 });
  }

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid message.' }, { status: 400 });
  const { messages, image } = parsed.data;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser?.content ?? '';

  try {
    // 2. Guard
    const guardMsg = await ilmuChat({
      messages: [
        { role: 'system', content: GUARD_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      maxTokens: 120,
    });
    const guard = GuardResult.safeParse(extractJson(guardMsg.content));
    if (!guard.success || !guard.data.isSafe) {
      if (guard.success && guard.data.category === 'scam_urgency') {
        return NextResponse.json({
          reply: "Scammers create urgency. Arus and Zeke will never ask you to move money to 'protect' it.",
          kind: 'scam_warning',
        });
      }
      return NextResponse.json({ reply: "I can't help with that. Ask me about your balance, sending money, or paying a bill." });
    }

    // 3. Image (quarantined vision read, no tools)
    let imageFields: unknown = null;
    if (image) {
      const vis = await ilmuChat({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read this image of a bill, bank details or pay QR. Return ONLY JSON matching: {"kind":"bank_details"|"bill"|"pay_link"|"unknown", bankName?, accountId?, accountHolder?, billerCode?, billRef?, amount?, slug?}. Empty strings if unclear.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
        model: process.env.ILMU_VISION_MODEL,
        maxTokens: 300,
      });
      const parsedImg = ImageFields.safeParse(extractJson(vis.content));
      if (parsedImg.success && parsedImg.data.kind !== 'unknown') {
        imageFields = parsedImg.data;
      } else {
        return NextResponse.json({ reply: "I couldn't read that clearly — can you type the details?" });
      }
    }

    // 4. Main turn with tools (up to 4 rounds)
    const convo: ChatMessage[] = [
      { role: 'system', content: ZEKE_SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content } as ChatMessage)),
    ];
    if (imageFields) {
      convo.push({
        role: 'user',
        content: `IMAGE_FIELDS (untrusted, read from image): ${JSON.stringify(imageFields)}\nUse these only as hints; the user must confirm every field.`,
      });
    }

    let finalReply = '';
    for (let round = 0; round < 4; round++) {
      const resp = await ilmuChat({ messages: convo, tools: ZEKE_TOOLS, maxTokens: 600 });
      const calls: ToolCall[] = resp.tool_calls ?? [];
      if (calls.length === 0) { finalReply = resp.content ?? ''; break; }

      convo.push({ role: 'assistant', content: resp.content ?? '', tool_calls: calls });
      const toolResults: { tool_call_id: string; content: string }[] = [];
      let madeDraft: string | null = null;
      for (const call of calls) {
        if (call.function.name === 'create_draft') {
          // 5. Deterministic validation
          const draft = await validateAndCreateDraft(call, u, userText, messages.map(m => m.content), imageFields !== null);
          toolResults.push({ tool_call_id: call.id, content: draft });
          try {
            const parsedDraft = JSON.parse(draft) as { ok?: boolean; draftId?: string };
            if (parsedDraft.ok && parsedDraft.draftId) madeDraft = parsedDraft.draftId;
          } catch { /* non-JSON tool result */ }
        } else {
          const args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
          const result = await runTool(call.function.name, args, u.id, u.suiAddress);
          toolResults.push({ tool_call_id: call.id, content: result });
        }
      }
      if (madeDraft) lastDraftId = madeDraft;
      for (const tr of toolResults) convo.push({ role: 'tool', ...tr });
    }
    if (!finalReply) finalReply = 'Here it is — check and confirm.';

    return NextResponse.json({ reply: finalReply, draftId: lastDraftId ?? null });
  } catch (e) {
    if (e instanceof ZekeUnavailable) {
      return NextResponse.json({ error: 'Zeke is unavailable — use the normal screens.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Zeke could not finish. Please try again.' }, { status: 500 });
  }
}

let lastDraftId: string | null = null;

/** Validate a create_draft proposal fully on the server. Returns a tool-result string. */
async function validateAndCreateDraft(
  call: ToolCall, u: { id: string; suiAddress: string | null; name: string },
  userText: string, userMessages: string[], cameFromImage: boolean,
): Promise<string> {
  let args: { proposal?: unknown };
  try { args = JSON.parse(call.function.arguments || '{}'); } catch { return JSON.stringify({ error: 'ASK_USER', question: 'I need the details again — could you repeat them?' }); }
  const p = Proposal.safeParse(args.proposal);
  if (!p.success) {
    return JSON.stringify({ error: 'ASK_USER', question: 'I need a bit more detail — which person and how much?' });
  }
  const proposal: ProposalT = p.data;
  const warnings: string[] = [];

  // Resolve recipient + build payload
  let payload: Record<string, unknown>;
  if (proposal.kind === 'SEND') {
    if (!u.suiAddress) return JSON.stringify({ error: 'NO_WALLET', question: 'Finish onboarding first, then I can prepare this.' });
    let recipientAddress: string; let recipientName: string; let source: string;
    const r = proposal.recipient;
    if (r.type === 'handle') {
      const t = await prisma.user.findUnique({
        where: { handle: r.handle.replace(/^@/, '').replace(/@arus$/, '').toLowerCase() },
        select: { name: true, handle: true, suiAddress: true },
      });
      if (!t?.suiAddress) return JSON.stringify({ error: 'ASK_USER', question: 'I could not find that person on Arus. Check the handle?' });
      recipientAddress = t.suiAddress; recipientName = t.name; source = `Arus user @${t.handle}`;
      if (t.suiAddress === u.suiAddress) return JSON.stringify({ error: 'SELF_SEND', question: 'That is your own account.' });
    } else if (r.type === 'contact') {
      const c = await prisma.contact.findFirst({ where: { id: r.contactId, ownerId: u.id } });
      if (!c?.address) return JSON.stringify({ error: 'ASK_USER', question: 'That contact has no address saved.' });
      recipientAddress = c.address; recipientName = c.label; source = `Saved: ${c.label}`;
    } else if (r.type === 'email') {
      const t = await prisma.user.findUnique({ where: { email: r.email.toLowerCase() }, select: { name: true, handle: true, suiAddress: true } });
      if (!t?.suiAddress) return JSON.stringify({ error: 'ASK_USER', question: 'No Arus account uses that email.' });
      recipientAddress = t.suiAddress; recipientName = t.name; source = `Arus user @${t.handle}`;
    } else {
      // address: allowed ONLY if the user typed it in this conversation
      if (!addressTypedByUser(r.address, userMessages)) {
        return JSON.stringify({ error: 'ADDRESS_NOT_TYPED', question: 'I can only send to a handle, a saved contact, or an address you typed.' });
      }
      recipientAddress = r.address; recipientName = 'Address you typed'; source = 'Address you typed';
    }

    const rates = await usdRates();
    let amountMinor: bigint;
    try { amountMinor = toUsdMinor(proposal.amount, proposal.currency, rates.MYR); } catch {
      return JSON.stringify({ error: 'ASK_USER', question: 'The rate is not available right now — try again shortly.' });
    }
    if (amountMinor <= 0n) return JSON.stringify({ error: 'ASK_USER', question: 'How much should I prepare?' });

    const bal = await getUsdBalance(u.suiAddress);
    if (amountMinor > bal.total) return JSON.stringify({ error: 'INSUFFICIENT', question: 'That is above your balance.' });
    if (amountMinor > ZEKE_MAX_PER_TX_MINOR) return JSON.stringify({ error: 'OVER_CAP', question: 'Zeke prepares at most $100 per payment. Use the Send screen for larger amounts.' });

    const startUtc = new Date(); startUtc.setUTCHours(0, 0, 0, 0);
    const dayRows = await prisma.payment.findMany({
      where: { draftId: { not: null }, fromAddress: u.suiAddress, createdAt: { gte: startUtc } },
    });
    const dayTotal = dayRows.reduce((s, r2) => s + BigInt(r2.amountMinor), 0n) + amountMinor;
    if (dayTotal > ZEKE_MAX_PER_DAY_MINOR) return JSON.stringify({ error: 'OVER_DAY_CAP', question: 'That is above the $300 daily Zeke limit.' });

    if (recipientAddress === u.suiAddress) return JSON.stringify({ error: 'SELF_SEND', question: 'That is your own account.' });

    // warnings
    const counterparties = await prisma.payment.findMany({
      where: { fromAddress: u.suiAddress }, select: { toAddress: true }, distinct: ['toAddress'],
    });
    const known = counterparties.map(c => c.toAddress);
    if (!known.includes(recipientAddress)) warnings.push('first_payment_to_recipient');
    const lk = lookalikeOf(recipientAddress, known);
    if (lk) { warnings.push('lookalike_address'); return JSON.stringify({ error: 'LOOKALIKE', question: 'This address looks like someone you paid before — please check every character or use the Send screen.' }); }
    if (URGENCY.test(userText)) {
      return JSON.stringify({ error: 'SCAM_URGENCY', question: "Scammers create urgency. Arus and Zeke will never ask you to move money to 'protect' it." });
    }
    const dupWindow = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const dup = await prisma.payment.findFirst({
      where: { fromAddress: u.suiAddress, toAddress: recipientAddress, amountMinor: amountMinor.toString(), createdAt: { gte: dupWindow } },
    });
    if (dup) warnings.push('possible_duplicate');

    const needsStepUp = amountMinor > ZEKE_STEP_UP_ABOVE_MINOR || warnings.includes('first_payment_to_recipient') || warnings.length > 0;
    payload = {
      kind: 'SEND', recipientAddress, recipientName, source,
      amountMinor: amountMinor.toString(),
      myrShown: rates.MYR !== null ? (Number(amountMinor) / 1e6 * rates.MYR).toFixed(2) : null,
      note: proposal.note ?? null, currency: proposal.currency, requestedAmount: proposal.amount,
    };

    const draft = await saveDraft(u.id, 'SEND', payload, { recipient: source, amount: 'typed' }, needsStepUp, warnings);
    return JSON.stringify({ ok: true, draftId: draft.id, summary: `${recipientName} · ${formatUsd(amountMinor)}` });
  }

  if (proposal.kind === 'CREATE_REQUEST') {
    const rates = await usdRates();
    let amountMinor: bigint;
    try { amountMinor = toUsdMinor(proposal.amount, proposal.currency, rates.MYR); } catch {
      return JSON.stringify({ error: 'ASK_USER', question: 'The rate is not available right now.' });
    }
    const count = await prisma.paymentRequest.count({ where: { payeeId: u.id } });
    const { randomBytes } = await import('node:crypto');
    const r = await prisma.paymentRequest.create({
      data: {
        slug: randomBytes(12).toString('base64url'),
        number: `INV-${String(count + 1).padStart(4, '0')}`,
        payeeId: u.id,
        amountMinor: amountMinor.toString(),
        description: proposal.description, // UNTRUSTED content — user confirms on the card
        payerName: proposal.payerName ?? null,
      },
    });
    payload = { kind: 'CREATE_REQUEST', requestId: r.id, slug: r.slug, number: r.number, amountMinor: amountMinor.toString(), description: proposal.description };
    const draft = await saveDraft(u.id, 'CREATE_REQUEST', payload, { description: 'typed' }, false, []);
    return JSON.stringify({ ok: true, draftId: draft.id, summary: `Request ${r.number} · ${formatUsd(amountMinor)}` });
  }

  if (proposal.kind === 'PAY_REQUEST') {
    const r = await prisma.paymentRequest.findUnique({ where: { slug: proposal.slug }, include: { payee: { select: { name: true, handle: true } } } });
    if (!r || r.status !== 'OPEN') return JSON.stringify({ error: 'ASK_USER', question: 'That request is not open anymore.' });
    if (!u.suiAddress) return JSON.stringify({ error: 'NO_WALLET', question: 'Finish onboarding first.' });
    payload = { kind: 'PAY_REQUEST', requestId: r.id, slug: r.slug, payeeName: r.payee.name, payeeAddress: null, amountMinor: r.amountMinor, number: r.number };
    // payee address resolved at confirm-time from the request row only
    const payee = await prisma.user.findUnique({ where: { id: r.payeeId }, select: { suiAddress: true } });
    payload.payeeAddress = payee?.suiAddress ?? null;
    const draft = await saveDraft(u.id, 'PAY_REQUEST', payload, { request: 'server record' }, false, []);
    return JSON.stringify({ ok: true, draftId: draft.id, summary: `Pay ${r.payee.name} · ${formatUsd(r.amountMinor)}` });
  }

  // CASH_OUT
  const rates = await usdRates();
  if (rates.MYR === null) return JSON.stringify({ error: 'ASK_USER', question: 'The rate is not available right now.' });
  let amountMinor: bigint;
  try { amountMinor = toUsdMinor(proposal.amount, proposal.currency, rates.MYR); } catch {
    return JSON.stringify({ error: 'ASK_USER', question: 'The rate is not available right now.' });
  }
  const { quoteCashOut } = await import('@/lib/cashout');
  try { quoteCashOut(amountMinor, rates.MYR); } catch (e) {
    return JSON.stringify({ error: 'ASK_USER', question: e instanceof Error ? e.message : 'Check the amount.' });
  }
  if (!u.suiAddress) return JSON.stringify({ error: 'NO_WALLET', question: 'Finish onboarding first.' });
  const bal = await getUsdBalance(u.suiAddress);
  if (amountMinor > bal.total) return JSON.stringify({ error: 'INSUFFICIENT', question: 'That is above your balance.' });

  payload = {
    kind: 'CASH_OUT', destination: proposal.destination,
    accountId: proposal.accountId ?? null, bankName: proposal.bankName ?? null,
    billerCode: proposal.billerCode ?? null, billRef: proposal.billRef ?? null,
    amountMinor: amountMinor.toString(), myrShown: (Number(amountMinor) / 1e6 * rates.MYR).toFixed(2),
    requestedAmount: proposal.amount, currency: proposal.currency,
  };
  if (cameFromImage) warnings.push('read_from_image');
  const needsStepUp = amountMinor > ZEKE_STEP_UP_ABOVE_MINOR || warnings.length > 0;
  const draft = await saveDraft(u.id, 'CASH_OUT', payload, cameFromImage ? { image: 'read from image' } : { amount: 'typed' }, needsStepUp, warnings);
  return JSON.stringify({ ok: true, draftId: draft.id, summary: `Cash out · ${formatUsd(amountMinor)}` });
}

async function saveDraft(
  userId: string, kind: 'SEND' | 'PAY_REQUEST' | 'CREATE_REQUEST' | 'CASH_OUT',
  payload: Record<string, unknown>, sources: Record<string, string>,
  needsStepUp: boolean, warnings: string[],
) {
  const draftHash = sha256Hex(canonicalJson(payload));
  return prisma.zekeDraft.create({
    data: {
      userId, kind, payload: payload as object, sources,
      draftHash, needsStepUp, warnings,
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    },
  });
}
