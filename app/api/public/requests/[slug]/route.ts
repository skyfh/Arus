import { NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/db';

export const dynamic = 'force-dynamic';

/** GET /api/public/requests/[slug] — public view: payee name/handle, amount, description (UNTRUSTED), status. Never the email. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await prisma.paymentRequest.findUnique({ where: { slug }, include: { payee: { select: { name: true, handle: true } } } });
  if (!r) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  return NextResponse.json({
    slug: r.slug,
    number: r.number,
    payeeName: r.payee.name,
    payeeHandle: r.payee.handle,
    amountMinor: r.amountMinor,
    description: r.description, // UNTRUSTED text written by the payee
    payerName: r.payerName,
    status: r.status,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  });
}
