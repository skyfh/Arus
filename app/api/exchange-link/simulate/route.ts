import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

/** POST /api/exchange-link/simulate — PENDING → LINKED (demo approval). */
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (u.exchangeLink !== 'PENDING') {
    return NextResponse.json({ error: 'Nothing to approve right now.' }, { status: 400 });
  }
  await prisma.user.update({ where: { id: u.id }, data: { exchangeLink: 'LINKED' } });
  return NextResponse.json({ status: 'LINKED' });
}
