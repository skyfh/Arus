import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

export const dynamic = 'force-dynamic';

/** GET /api/allowances/[id]/funder — the funder's address (needed to draw). Receiver or funder only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const row = await prisma.allowance.findUnique({
    where: { id },
    include: { funder: { select: { suiAddress: true } } },
  });
  if (!row) return NextResponse.json({ error: 'Allowance not found.' }, { status: 404 });

  const allowed = row.funderId === u.id || row.spenderAddress === u.suiAddress;
  if (!allowed) return NextResponse.json({ error: 'Not your allowance.' }, { status: 403 });
  if (!row.funder.suiAddress) return NextResponse.json({ error: 'The funder has no wallet yet.' }, { status: 400 });

  return NextResponse.json({ funderAddress: row.funder.suiAddress });
}
