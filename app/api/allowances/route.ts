import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';
import { usdToMinor } from '@/lib/sui/money';

export const dynamic = 'force-dynamic';

const Body = z.object({
  handle: z.string().max(24).optional(),
  address: z.string().max(80).optional(),
  spenderLabel: z.string().min(1).max(40),
  monthlyLimit: z.string().regex(/^\d+(\.\d{1,6})?$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET /api/allowances — what I give and what I receive. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ allowancesGiven: [], allowancesReceived: [] });

  const given = await prisma.allowance.findMany({
    where: { funderId: u.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  const received = await prisma.allowance.findMany({
    where: { spenderAddress: u.suiAddress, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ allowancesGiven: given, allowancesReceived: received });
}

/**
 * POST /api/allowances — register a native Sui allowance.
 * The client builds the tx with the frozen buildCreateAllowance, signs, sends the digest;
 * the server re-reads the transaction and confirms the Allowance/Cap objects were created
 * by that digest from the funder's address.
 */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) return NextResponse.json({ error: 'Fill in the person, monthly limit and end date.' }, { status: 400 });
  const { handle, address, spenderLabel, monthlyLimit, endDate } = parsed.data;

  // Resolve spender
  let spender: string;
  if (handle) {
    const t = await prisma.user.findUnique({
      where: { handle: handle.replace(/^@/, '').replace(/@arus$/, '').toLowerCase() },
      select: { suiAddress: true },
    });
    if (!t?.suiAddress) return NextResponse.json({ error: 'That person has no wallet yet.' }, { status: 404 });
    spender = t.suiAddress;
  } else if (address && /^0x[0-9a-fA-F]{40,64}$/.test(address)) {
    spender = address;
  } else {
    return NextResponse.json({ error: 'Pick a handle or paste an address.' }, { status: 400 });
  }
  if (spender === u.suiAddress) return NextResponse.json({ error: 'You cannot give yourself an allowance.' }, { status: 400 });

  let monthlyLimitMinor: bigint;
  try { monthlyLimitMinor = usdToMinor(monthlyLimit); } catch { return NextResponse.json({ error: 'Enter a limit like 30 or 30.00.' }, { status: 400 }); }
  if (monthlyLimitMinor <= 0n) return NextResponse.json({ error: 'Limit must be above zero.' }, { status: 400 });

  const expiresAt = new Date(endDate + 'T23:59:59Z');
  if (expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'The end date must be in the future.' }, { status: 400 });

  const { digest, allowanceId, capObjectId } = z.object({
    digest: z.string().min(20),
    allowanceId: z.string().min(20),
    capObjectId: z.string().min(20),
  }).parse(j);

  // Verify on chain: the allowance objects were created by this digest, sent by the user
  const { suiClient } = await import('@/lib/sui/config');
  const res = await suiClient.getTransaction({ digest, include: { effects: true, objectTypes: true, transaction: true } });
  const t = res.$kind === 'Transaction' ? res.Transaction : res.FailedTransaction;
  const { normalizeSuiAddress } = await import('@mysten/sui/utils');
  const sender = normalizeSuiAddress(t.transaction?.sender ?? '');
  if (!t.status.success || sender !== normalizeSuiAddress(u.suiAddress)) {
    return NextResponse.json({ error: 'That transaction does not match your account.' }, { status: 400 });
  }
  const created = (t.effects?.changedObjects ?? []).filter(o => o.idOperation === 'Created').map(o => o.objectId);
  if (!created.includes(allowanceId) || !created.includes(capObjectId)) {
    return NextResponse.json({ error: 'The allowance objects were not created by this transaction.' }, { status: 400 });
  }

  const row = await prisma.allowance.create({
    data: {
      funderId: u.id,
      spenderAddress: spender,
      spenderLabel: spenderLabel.trim(),
      name: `${spenderLabel.trim()} — monthly`,
      monthlyLimitMinor: monthlyLimitMinor.toString(),
      expiresAt,
      allowanceObjectId: allowanceId,
      capObjectId,
      createTx: digest,
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
