import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

export const dynamic = 'force-dynamic';

/** GET /api/counterparties — distinct on-chain addresses I've paid (for lookalike checks). */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ addresses: [] });

  const rows = await prisma.payment.findMany({
    where: { fromAddress: u.suiAddress },
    select: { toAddress: true },
    distinct: ['toAddress'],
  });
  return NextResponse.json({ addresses: rows.map(r => r.toAddress) });
}
