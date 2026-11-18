import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

/** POST /api/zeke/drafts/[id]/cancel — owner only. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const d = await prisma.zekeDraft.findUnique({ where: { id } });
  if (!d || d.userId !== u.id) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
  if (d.status !== 'PENDING') return NextResponse.json({ error: 'This draft was already used.' }, { status: 400 });

  await prisma.zekeDraft.update({ where: { id }, data: { status: 'CANCELLED' } });
  return NextResponse.json({ ok: true });
}
