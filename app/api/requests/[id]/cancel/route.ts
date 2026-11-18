import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

/** POST /api/requests/[id]/cancel — payee only, only while OPEN. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const r = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!r || r.payeeId !== u.id) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  if (r.status !== 'OPEN') return NextResponse.json({ error: 'Only open requests can be cancelled.' }, { status: 400 });

  await prisma.paymentRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  return NextResponse.json({ ok: true });
}
