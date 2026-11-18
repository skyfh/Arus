import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { usdToMinor } from '@/lib/sui/money';

const Body = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'amount like 25 or 25.50'),
  description: z.string().min(1).max(140),
  payerName: z.string().max(80).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lineItems: z.array(z.object({ label: z.string().max(80), amount: z.string().max(20) })).max(20).optional(),
});

/** POST /api/requests — create a payment request (invoice). */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Enter an amount and a short description.' }, { status: 400 });
  const { amount, description, payerName, dueDate, lineItems } = parsed.data;

  let amountMinor: bigint;
  try { amountMinor = usdToMinor(amount); } catch { return NextResponse.json({ error: 'Enter an amount like 25 or 25.50.' }, { status: 400 }); }
  if (amountMinor <= 0n) return NextResponse.json({ error: 'Amount must be above zero.' }, { status: 400 });

  // INV-0001 per payee
  const count = await prisma.paymentRequest.count({ where: { payeeId: u.id } });
  const number = `INV-${String(count + 1).padStart(4, '0')}`;

  const r = await prisma.paymentRequest.create({
    data: {
      slug: randomBytes(12).toString('base64url'),
      number,
      payeeId: u.id,
      amountMinor: amountMinor.toString(),
      description: description.trim(),
      payerName: payerName?.trim() || null,
      lineItems: lineItems ?? undefined,
    },
  });
  return NextResponse.json({ ok: true, id: r.id, slug: r.slug, number: r.number });
}

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const rows = await prisma.paymentRequest.findMany({
    where: { payeeId: u.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ requests: rows });
}
