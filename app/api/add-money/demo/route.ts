import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { demoTopUpUsd, TOPUP_OPTIONS_MINOR } from '@/lib/sui/topup.server';
import { usdToMinor } from '@/lib/sui/money';

const Body = z.object({ method: z.enum(['APPLE_PAY', 'CARD', 'HALLIDAY', 'HATA']), amountMinor: z.string() });

/** 3 top-ups per user per hour (demo card/Apple Pay/Halliday). */
async function topUpCountLastHour(userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  return prisma.payment.count({
    where: { kind: 'TOP_UP', createdAt: { gte: oneHourAgo }, receipt: { is: {} } },
  }).then(async (n) => n);
}

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Pick a demo payment method and amount.' }, { status: 400 });
  const { method, amountMinor: amountStr } = parsed.data;

  const amountMinor = BigInt(amountStr);
  if (!TOPUP_OPTIONS_MINOR.includes(amountMinor as never)) {
    return NextResponse.json({ error: 'Top-ups are $10, $20 or $50 in this demo.' }, { status: 400 });
  }

  // rate limit: 3 per hour per user (all demo methods; Hata transfers go through the same wallet address but are simulated, so also capped)
  const count = await prisma.payment.count({
    where: {
      kind: 'TOP_UP',
      toAddress: u.suiAddress,
      createdAt: { gte: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (count >= 3) {
    return NextResponse.json({ error: 'Top-up limit reached (3 per hour). Try again later.' }, { status: 429 });
  }

  try {
    const res = await demoTopUpUsd(u.suiAddress, amountMinor);
    // Record the TOP_UP payment. Verification: it's a faucet->user transfer; verify server-side via the digest.
    const { verifyUsdPayment } = await import('@/lib/sui/verify.server');
    const v = await verifyUsdPayment({
      digest: res.digest,
      sender: process.env.SPLASH_FAUCET_SECRET_KEY ? (await import('@mysten/sui/keypairs/ed25519')).Ed25519Keypair.fromSecretKey(process.env.SPLASH_FAUCET_SECRET_KEY).toSuiAddress() : '',
      recipient: u.suiAddress,
      amountMinor,
    });
    if (!v.ok) {
      return NextResponse.json({ error: 'The top-up could not be verified on chain. Nothing was added.' }, { status: 400 });
    }
    await prisma.payment.create({
      data: {
        kind: 'TOP_UP',
        fromAddress: v.sender,
        toAddress: u.suiAddress,
        amountMinor: amountMinor.toString(),
        txDigest: res.digest,
        note: `Demo top-up via ${method}`,
      },
    });
    return NextResponse.json({ ok: true, digest: res.digest });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Top-up failed on chain. Nothing was added.' }, { status: 502 });
  }
}
