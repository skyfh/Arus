import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';

/** GET /api/users/resolve?handle=aina (accepts @aina, aina, aina@arus) — public, name/handle/address only. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('handle')?.trim().toLowerCase() ?? '';
  const h = raw.replace(/^@/, '').replace(/@arus$/, '');
  if (!h) return NextResponse.json({ error: 'Enter a handle.' }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { handle: h } });
  if (!u || !u.suiAddress) return NextResponse.json({ error: 'No account with that handle.' }, { status: 404 });
  return NextResponse.json({ name: u.name, handle: u.handle, address: u.suiAddress });
}
