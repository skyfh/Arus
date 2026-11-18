import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { formatUsd } from '@/lib/sui/money';

export const dynamic = 'force-dynamic';

/** GET /api/zeke/drafts/[id] — owner only; the server payload for the ConfirmCard. The model's text never appears here. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const { id } = await ctx.params;

  const d = await prisma.zekeDraft.findUnique({ where: { id } });
  if (!d || d.userId !== u.id) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
  if (d.status !== 'PENDING') return NextResponse.json({ error: 'This draft was already used or cancelled.' }, { status: 400 });
  if (d.expiresAt.getTime() < Date.now()) {
    await prisma.zekeDraft.update({ where: { id }, data: { status: 'EXPIRED' } });
    return NextResponse.json({ error: 'This draft expired. Ask Zeke again.' }, { status: 400 });
  }

  const p = d.payload as Record<string, unknown>;
  return NextResponse.json({
    id: d.id, kind: d.kind, payload: p, sources: d.sources,
    needsStepUp: d.needsStepUp, warnings: d.warnings,
    draftHash: d.draftHash,
    expiresAt: d.expiresAt,
    // convenience display fields (server-computed, never model text)
    amountFormatted: p.amountMinor ? formatUsd(BigInt(p.amountMinor as string)) : null,
  });
}
