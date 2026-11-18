import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import {
  verifyPassword, createSessionToken, setSessionCookie,
  loginRateLimit, loginRateLimitReset,
} from '@/lib/auth/session.server';

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const rl = loginRateLimit(email);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many tries. Please wait a few minutes and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 600) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 });
  }

  loginRateLimitReset(email);
  const token = await createSessionToken({ userId: user.id });
  await setSessionCookie(token);
  return NextResponse.json({ id: user.id, handle: user.handle, name: user.name });
}
