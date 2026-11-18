import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { verifyUsdPayment } from '@/lib/sui/verify.server';
import { canonicalJson, sha256Hex, storeReceiptOnWalrus } from '@/lib/sui/walrus.server';
import { toUsdMinor } from '@/lib/zeke/provenance';

const Body = z.object({
  digest: z.string().min(20),
  kind: z.enum(['SEND', 'REQUEST_PAYMENT', 'ALLOWANCE_DRAW', 'CASH_OUT']),
  toAddress: z.string().min(40),
  amountMinor: z.string(),
  requestSlug: z.string().optional(),
  allowanceId: z.string().optional(),
  note: z.string().max(140).optional(),
  draftId: z.string().optional(),
});

/** The browser signed and ran a payment; verify on chain, then save Payment + Receipt idempotently. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details.' }, { status: 400 });
  const b = parsed.data;

  const amountMinor = BigInt(b.amountMinor);
  if (amountMinor <= 0n) return NextResponse.json({ error: 'Amount must be above zero.' }, { status: 400 });

  // Idempotency: same digest -> same receipt
  const existing = await prisma.payment.findUnique({ where: { txDigest: b.digest }, include: { receipt: true } });
  if (existing) {
    return NextResponse.json({ ok: true, digest: existing.txDigest, receiptId: existing.receipt?.id ?? null, existing: true });
  }

  const v = await verifyUsdPayment({ digest: b.digest, sender: u.suiAddress, recipient: b.toAddress, amountMinor });
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

  // Basic-tier daily limit: $1,000/day for sends + cash-outs combined
  if (b.kind === 'SEND' || b.kind === 'CASH_OUT') {
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const rows = await prisma.payment.findMany({
      where: { fromAddress: u.suiAddress, kind: { in: ['SEND', 'CASH_OUT'] }, createdAt: { gte: startOfDay } },
    });
    const total = rows.reduce((s, r) => s + BigInt(r.amountMinor), 0n) + amountMinor;
    if (total > 1_000_000_000n) {
      return NextResponse.json({ error: 'That is above your $1,000 daily limit. Verify fully to raise it.' }, { status: 403 });
    }
  }

  // If paying a request: amount must match the request exactly
  let requestId: string | null = null;
  if (b.requestSlug) {
    const r = await prisma.paymentRequest.findUnique({ where: { slug: b.requestSlug } });
    if (!r || r.status !== 'OPEN') return NextResponse.json({ error: 'That request is not open.' }, { status: 400 });
    if (BigInt(r.amountMinor) !== amountMinor) {
      return NextResponse.json({ error: 'The amount paid does not match the request.' }, { status: 400 });
    }
    requestId = r.id;
  }

  const payment = await prisma.payment.create({
    data: {
      kind: b.kind,
      fromAddress: u.suiAddress,
      toAddress: b.toAddress,
      amountMinor: amountMinor.toString(),
      txDigest: b.digest,
      note: b.note ?? null,
      requestId,
      allowanceId: b.allowanceId ?? null,
      draftId: b.draftId ?? null,
    },
  });

  // Mark request paid (idempotent on paidTxDigest)
  if (requestId) {
    await prisma.paymentRequest.updateMany({
      where: { id: requestId, status: 'OPEN' },
      data: { status: 'PAID', paidTxDigest: b.digest, paidBy: u.suiAddress, paidAt: new Date() },
    });
  }

  // Receipt: exact JSON that was hashed
  const body = {
    kind: b.kind,
    amountMinor: amountMinor.toString(),
    from: u.suiAddress,
    to: b.toAddress,
    txDigest: b.digest,
    requestId,
    allowanceId: b.allowanceId ?? null,
    draftId: b.draftId ?? null,
    draftedBy: b.draftId ? 'zeke' : null,
    note: b.note ?? null,
    network: 'sui-testnet',
    createdAt: new Date().toISOString(),
  };
  const bodyJson = canonicalJson(body);
  const sha256 = sha256Hex(bodyJson);
  const receipt = await prisma.receipt.create({
    data: { paymentId: payment.id, body: body as object, sha256 },
  });

  // Walrus after responding (non-blocking best effort)
  void (async () => {
    try {
      const w = await storeReceiptOnWalrus(body);
      if (w.blobId) {
        await prisma.receipt.update({ where: { id: receipt.id }, data: { walrusBlobId: w.blobId, walrusUrl: w.url } });
      }
    } catch { /* never blocks a payment */ }
  })();

  return NextResponse.json({ ok: true, digest: payment.txDigest, receiptId: receipt.id });
}
