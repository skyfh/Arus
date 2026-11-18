import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

/** GET /api/me — id, name, handle, kyc tier, gift status. No secrets. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  return NextResponse.json({
    id: u.id,
    name: u.name,
    handle: u.handle,
    email: u.email,
    accountType: u.accountType,
    businessName: u.businessName,
    suiAddress: u.suiAddress,
    kycTier: u.kycTier,
    exchangeLink: u.exchangeLink,
    giftAt: u.giftAt,
    zekeEnabled: u.zekeEnabled,
  });
}

/** Mark the $20 gift as given (used by /api/gift after it succeeds). */
export async function POST() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  await prisma.user.update({ where: { id: u.id }, data: { giftAt: new Date() } });
  return NextResponse.json({ ok: true });
}
