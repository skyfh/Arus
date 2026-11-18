import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

export const dynamic = 'force-dynamic';

/** GET /api/cashout/[id] — status timeline for my cash-out. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.cashOut.findUnique({ where: { id } });
  if (!row || row.userId !== u.id) return NextResponse.json({ error: 'Cash-out not found.' }, { status: 404 });

  const ageSec = (Date.now() - row.createdAt.getTime()) / 1000;
  const isBill = row.destination === 'JOMPAY_BILL';
  return NextResponse.json({
    id: row.id,
    amountMinor: row.amountMinor,
    myrSen: row.myrSen,
    destination: row.destination,
    createdAt: row.createdAt,
    txDigest: row.txDigest,
    steps: [
      { label: 'Sent to exchange', simulated: false, done: true, txDigest: row.txDigest },
      { label: 'Converted', simulated: true, done: ageSec >= 8 },
      { label: isBill ? 'Paid to biller' : 'Paid via DuitNow', simulated: true, done: ageSec >= 20 },
    ],
  });
}
