import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';

export const dynamic = 'force-dynamic';

/** GET /api/public/receipts/[id] — public receipt (the token is the id; no login). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await prisma.receipt.findUnique({ where: { id }, include: { payment: true } });
  if (!r) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  return NextResponse.json({
    id: r.id,
    body: r.body,
    sha256: r.sha256,
    walrusBlobId: r.walrusBlobId,
    walrusUrl: r.walrusUrl,
    txDigest: r.payment.txDigest,
    createdAt: r.createdAt,
  });
}
