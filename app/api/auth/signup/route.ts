import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth/session.server';
import { handleValid, handleRefusal } from '@/lib/handles';

const Body = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  handle: z.string().min(3).max(20),
  accountType: z.enum(['PERSONAL', 'BUSINESS']).default('PERSONAL'),
  businessName: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please fill in all fields correctly.' }, { status: 400 });
  }
  const { name, email, password, handle, accountType, businessName } = parsed.data;
  const h = handle.trim().toLowerCase();

  if (!handleValid(h)) {
    return NextResponse.json({ error: handleRefusal(h) }, { status: 400 });
  }
  if (accountType === 'BUSINESS' && !businessName) {
    return NextResponse.json({ error: 'Business accounts need a business name.' }, { status: 400 });
  }

  const emailTaken = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (emailTaken) {
    return NextResponse.json({ error: 'That email already has an account. Try logging in.' }, { status: 409 });
  }
  const handleTaken = await prisma.user.findUnique({ where: { handle: h } });
  if (handleTaken) {
    return NextResponse.json({ error: 'That handle is taken. Please pick another.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      handle: h,
      accountType,
      businessName: accountType === 'BUSINESS' ? businessName?.trim() : null,
    },
  });

  const token = await createSessionToken({ userId: user.id });
  await setSessionCookie(token);
  return NextResponse.json({ id: user.id, handle: user.handle, name: user.name });
}
