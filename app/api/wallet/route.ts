import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { normalizeSuiAddress } from '@mysten/sui/utils';

const Body = z.object({ address: z.string().min(40).max(80) });

/** Save the user's Sui address once. 409 if a different address is already saved. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });

  let address: string;
  try {
    address = normalizeSuiAddress(parsed.data.address);
  } catch {
    return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  }

  if (u.suiAddress) {
    if (u.suiAddress !== address) {
      return NextResponse.json({ error: 'This account already has a wallet. Restore your key instead of making a new one.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, address: u.suiAddress });
  }

  await prisma.user.update({ where: { id: u.id }, data: { suiAddress: address } });
  return NextResponse.json({ ok: true, address });
}
