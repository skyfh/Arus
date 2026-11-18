import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

/** DELETE /api/contacts/[id] — owner only. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c || c.ownerId !== u.id) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
