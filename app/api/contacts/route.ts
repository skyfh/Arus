import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { handleValid } from '@/lib/handles';

const Body = z.object({
  label: z.string().min(1).max(40),
  handle: z.string().max(24).optional(),
  address: z.string().max(80).optional(),
});

/** Contacts are created ONLY by the user in the UI, never by Zeke. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Give the contact a name.' }, { status: 400 });
  const { label, handle, address } = parsed.data;

  if (handle && !handleValid(handle.replace(/^@/, '').replace(/@arus$/, '').toLowerCase())) {
    return NextResponse.json({ error: 'That handle is not valid.' }, { status: 400 });
  }

  try {
    const c = await prisma.contact.create({
      data: {
        ownerId: u.id,
        label: label.trim(),
        handle: handle ? handle.replace(/^@/, '').replace(/@arus$/, '').toLowerCase() : null,
        address: address ?? null,
      },
    });
    return NextResponse.json({ ok: true, id: c.id });
  } catch {
    return NextResponse.json({ error: 'You already have a contact with that name.' }, { status: 409 });
  }
}

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const contacts = await prisma.contact.findMany({ where: { ownerId: u.id }, orderBy: { label: 'asc' } });
  return NextResponse.json({ contacts });
}
