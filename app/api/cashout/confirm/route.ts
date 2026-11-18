import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { quoteCashOut } from '@/lib/cashout';
import { usdRates } from '@/lib/fx.server';

const Body = z.object({
  token: z.string().min(20),
  signature: z.string().min(20),
  digest: z.string().min(20),
});

/** POST /api/cashout/confirm — verify the signed quote + on-chain leg, save CashOut (last 4 only), return the timeline. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid confirmation.' }, { status: 400 });
  const { token, signature, digest } = parsed.data;

  // Verify quote: HMAC + 60s expiry
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString());
  } catch { return NextResponse.json({ error: 'The quote is damaged. Please get a new one.' }, { status: 400 }); }
  const expected = createHmac('sha256', process.env.SESSION_SECRET!).update(Buffer.from(token, 'base64url')).digest('base64url');
  if (signature !== expected) return NextResponse.json({ error: 'The quote was tampered with. Please start again.' }, { status: 400 });
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return NextResponse.json({ error: 'The quote expired. Please get a new one.' }, { status: 400 });
  }
  if (payload.userId !== u.id) return NextResponse.json({ error: 'That quote belongs to another account.' }, { status: 400 });

  const amountMinor = BigInt(payload.amountMinor as string);
  const rates = await usdRates();
  if (rates.MYR === null) return NextResponse.json({ error: 'The exchange rate is unavailable. Try again shortly.' }, { status: 503 });
  const q = quoteCashOut(amountMinor, rates.MYR);
  if (q.myrSen !== BigInt(payload.myrSen as string)) {
    return NextResponse.json({ error: 'The rate changed. Please get a new quote.' }, { status: 400 });
  }

  const DEPOSIT = process.env.NEXT_PUBLIC_DEMO_EXCHANGE_DEPOSIT_ADDRESS;
  if (!DEPOSIT) return NextResponse.json({ error: 'The demo exchange is not configured.' }, { status: 503 });

  // Verify the on-chain leg to the demo exchange address
  const { verifyUsdPayment } = await import('@/lib/sui/verify.server');
  const v = await verifyUsdPayment({ digest, sender: u.suiAddress, recipient: DEPOSIT, amountMinor });
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });

  // Save CashOut: NEVER the full account/phone/reference — last 4 only
  const accountId = (payload.accountId as string | null) ?? '';
  const billRef = (payload.billRef as string | null) ?? '';
  const { last4 } = await import('@/lib/cashout');
  const row = await prisma.cashOut.create({
    data: {
      userId: u.id,
      destination: payload.destination as never,
      bankName: (payload.bankName as string | null) ?? null,
      billerCode: (payload.billerCode as string | null) ?? null,
      accountHolder: u.name,
      accountLast4: last4(accountId || billRef || '0000'),
      amountMinor: amountMinor.toString(),
      feeMinor: q.feeMinor.toString(),
      rate: String(q.rate),
      myrSen: q.myrSen.toString(),
      txDigest: digest,
    },
  });

  await prisma.payment.create({
    data: {
      kind: 'CASH_OUT',
      fromAddress: u.suiAddress,
      toAddress: DEPOSIT,
      amountMinor: amountMinor.toString(),
      txDigest: digest,
      note: `Cash out via ${payload.destination}`,
    },
  });

  // Timeline computed from createdAt: Sent (real) → Converted 8s → Paid 20s (both simulated)
  return NextResponse.json({
    ok: true,
    id: row.id,
    createdAt: row.createdAt,
    steps: [
      { label: 'Sent to exchange', simulated: false, txDigest: digest },
      { label: payload.destination === 'JOMPAY_BILL' ? 'Paid to biller' : 'Paid via DuitNow', simulated: true, afterSec: 20 },
      { label: 'Converted', simulated: true, afterSec: 8 },
    ].sort((a, b) => (a.afterSec ?? 0) - (b.afterSec ?? 0)),
  });
}
