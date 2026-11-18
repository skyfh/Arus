import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session.server';
import { dripTestFunds } from '@/lib/sui/faucet.server';

/**
 * One-time $20 welcome gift: $20 test USD + 0.1 SUI for fees, sent from the
 * faucet wallet to the user's registered address. Server-only key.
 */
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (u.giftAt) return NextResponse.json({ error: 'You already received your welcome gift.' }, { status: 409 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  try {
    const res = await dripTestFunds(u.suiAddress, { usd: true });
    // Mark as given via /api/me POST after client confirms; do it here too for safety.
    return NextResponse.json({ ok: true, digest: res.digest });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add test money right now.' }, { status: 502 });
  }
}
