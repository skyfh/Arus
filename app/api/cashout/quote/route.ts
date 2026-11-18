import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { currentUser } from '@/lib/auth/session.server';
import { quoteCashOut, validateDestination, Destination } from '@/lib/cashout';
import { usdToMinor } from '@/lib/sui/money';
import { usdRates } from '@/lib/fx.server';

const Body = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  destination: z.enum(['RYT_BANK', 'TNG_EWALLET', 'OTHER_DUITNOW', 'JOMPAY_BILL']),
  accountId: z.string().max(40).optional(),
  bankName: z.string().max(40).optional(),
  billerCode: z.string().max(10).optional(),
  billRef: z.string().max(30).optional(),
});

/** POST /api/cashout/quote — 60s HMAC-signed quote. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Enter an amount and destination details.' }, { status: 400 });
  const b = parsed.data;

  let amountMinor: bigint;
  try { amountMinor = usdToMinor(b.amount); } catch { return NextResponse.json({ error: 'Enter an amount like 25 or 25.50.' }, { status: 400 }); }

  const rates = await usdRates();
  if (rates.MYR === null) return NextResponse.json({ error: 'The exchange rate is unavailable right now. Try again shortly.' }, { status: 503 });

  // JomPAY needs biller code; TNG / banks need an account id
  if (b.destination === 'JOMPAY_BILL' && !b.billerCode) {
    return NextResponse.json({ error: 'Enter the JomPAY biller code.' }, { status: 400 });
  }
  if (b.destination !== 'JOMPAY_BILL' && !b.accountId) {
    return NextResponse.json({ error: 'Enter the account number or mobile number.' }, { status: 400 });
  }
  const validatedId = b.accountId ? validateDestination(b.destination as Destination, b.accountId) : null;
  if (b.accountId && validatedId === null) {
    return NextResponse.json({ error: 'That account number is not valid.' }, { status: 400 });
  }

  let quote;
  try { quote = quoteCashOut(amountMinor, rates.MYR); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not quote.' }, { status: 400 });
  }

  const payload = JSON.stringify({
    userId: u.id, amountMinor: amountMinor.toString(), destination: b.destination,
    accountId: validatedId, bankName: b.bankName ?? null, billerCode: b.billerCode ?? null, billRef: b.billRef ?? null,
    myrSen: quote.myrSen.toString(), exp: Date.now() + 60_000,
  });
  const sig = createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('base64url');

  return NextResponse.json({
    quote: {
      amountMinor: amountMinor.toString(),
      feeMinor: quote.feeMinor.toString(),
      netMinor: quote.netMinor.toString(),
      rate: quote.rate,
      myrSen: quote.myrSen.toString(),
      destination: b.destination,
      accountId: validatedId,
      bankName: b.bankName ?? null,
      billerCode: b.billerCode ?? null,
      billRef: b.billRef ?? null,
    },
    token: Buffer.from(payload).toString('base64url'),
    signature: sig,
    expiresInSec: 60,
  });
}
