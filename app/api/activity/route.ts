import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

export const dynamic = 'force-dynamic';

/** GET /api/activity — every payment involving my address, newest first. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ transactions: [] });

  const payments = await prisma.payment.findMany({
    where: { OR: [{ fromAddress: u.suiAddress }, { toAddress: u.suiAddress }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { receipt: { select: { id: true } } },
  });

  const me = u.suiAddress;
  const known = await prisma.user.findMany({
    where: { suiAddress: { in: payments.flatMap(p => [p.fromAddress, p.toAddress]) } },
    select: { suiAddress: true, name: true, handle: true },
  });
  const label = new Map(known.map(k => [k.suiAddress, k.handle ? `${k.name} (@${k.handle})` : k.name]));

  return NextResponse.json({
    transactions: payments.map(p => ({
      id: p.id,
      kind: p.kind,
      amountMinor: p.amountMinor,
      txDigest: p.txDigest,
      direction: p.fromAddress === me ? 'out' : 'in',
      counterparty: label.get(p.fromAddress === me ? p.toAddress : p.fromAddress)
        ?? (p.fromAddress === me ? 'Sent' : 'Received'),
      createdAt: p.createdAt,
      receiptId: p.receipt?.id ?? null,
      note: p.note,
    })),
  });
}
