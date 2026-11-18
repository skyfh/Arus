import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { getSession, verifyPassword, createStepUpToken } from '@/lib/auth/session.server';

const Body = z.object({ password: z.string().min(1), purpose: z.string().min(1).max(100) });

/** "Confirm it's you": re-check the password, return a 5-minute step-up token bound to `purpose`. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your password.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: 'That password is not right.' }, { status: 401 });
  }

  const token = await createStepUpToken(user.id, parsed.data.purpose);
  return NextResponse.json({ stepUpToken: token, expiresInSec: 300 });
}
