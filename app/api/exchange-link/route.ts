import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

export const dynamic = 'force-dynamic';

/** GET /api/exchange-link — current demo exchange link status. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  return NextResponse.json({ status: u.exchangeLink });
}

/** POST /api/exchange-link — PERSONAL: start a (demo) link; BUSINESS: straight to Splash payout partner (demo). */
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (u.accountType === 'BUSINESS') {
    await prisma.user.update({ where: { id: u.id }, data: { exchangeLink: 'LINKED' } });
    return NextResponse.json({ status: 'LINKED', partner: 'Splash payout partner (demo)' });
  }
  await prisma.user.update({ where: { id: u.id }, data: { exchangeLink: 'PENDING' } });
  return NextResponse.json({ status: 'PENDING' });
}
