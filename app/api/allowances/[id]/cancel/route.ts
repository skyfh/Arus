import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

const Body = z.object({ digest: z.string().min(20) });

/** POST /api/allowances/[id]/cancel — funder only; verifies the revoke tx on chain. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.allowance.findUnique({ where: { id } });
  if (!row || row.funderId !== u.id) return NextResponse.json({ error: 'Allowance not found.' }, { status: 404 });
  if (row.status !== 'ACTIVE') return NextResponse.json({ error: 'This allowance is already cancelled.' }, { status: 400 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Missing the cancel transaction.' }, { status: 400 });

  const { suiClient } = await import('@/lib/sui/config');
  const { normalizeSuiAddress } = await import('@mysten/sui/utils');
  const res = await suiClient.getTransaction({ digest: parsed.data.digest, include: { effects: true, transaction: true } });
  const t = res.$kind === 'Transaction' ? res.Transaction : res.FailedTransaction;
  const sender = normalizeSuiAddress(t.transaction?.sender ?? '0x0');
  if (!t.status.success || sender !== normalizeSuiAddress(u.suiAddress ?? '0x0')) {
    return NextResponse.json({ error: 'That cancel transaction does not match your account.' }, { status: 400 });
  }

  await prisma.allowance.update({ where: { id }, data: { status: 'CANCELLED', cancelTx: parsed.data.digest } });
  return NextResponse.json({ ok: true });
}
