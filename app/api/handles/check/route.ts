import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { handleValid, handleRefusal } from '@/lib/handles';

/** GET /api/handles/check?h=aina — live availability for the signup form. */
export async function GET(req: Request) {
  const h = new URL(req.url).searchParams.get('h')?.trim().toLowerCase() ?? '';
  if (!h) return NextResponse.json({ available: false, error: 'Enter a handle.' });
  if (!handleValid(h)) {
    return NextResponse.json({ available: false, error: handleRefusal(h) });
  }
  const taken = await prisma.user.findUnique({ where: { handle: h } });
  return NextResponse.json({ available: !taken, error: taken ? 'That handle is taken. Please pick another.' : undefined });
}
