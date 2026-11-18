import { notFound } from 'next/navigation';
import { prisma } from '@/lib/auth/db';
import { formatUsd } from '@/lib/sui/money';
import { PayRequestClient } from '@/components/pay-request-client';

export const dynamic = 'force-dynamic';

/** /pay/[slug]: request page. Inline sign-up for visitors; Pay button for logged-in users. */
export default async function PayRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.paymentRequest.findUnique({ where: { slug }, include: { payee: { select: { name: true, handle: true } } } });
  if (!r) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 flex flex-col gap-4">
        <p className="text-xs text-[color:var(--pending)] tnum">{r.number} · Payment request</p>
        <h1 className="text-3xl font-bold tnum">{formatUsd(BigInt(r.amountMinor))}</h1>
        <p className="text-sm">
          Pay <strong>{r.payee.name}</strong> <span className="text-[color:var(--ink-muted)] tnum">({r.payee.handle}@arus)</span>
        </p>
        <p className="text-sm text-[color:var(--ink-muted)]">{r.description}</p>
        {r.payerName && <p className="text-sm">For: {r.payerName}</p>}
        {r.status === 'PAID' && (
          <p className="text-sm rounded-xl p-3" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            Paid on {r.paidAt ? new Date(r.paidAt).toLocaleString() : ''}
          </p>
        )}
        {r.status === 'CANCELLED' && (
          <p className="text-sm rounded-xl p-3" style={{ background: 'var(--pending-bg)', color: 'var(--pending)' }}>
            This request was cancelled.
          </p>
        )}
        {r.status === 'OPEN' && <PayRequestClient slug={r.slug} amountMinor={r.amountMinor} />}
        <p className="text-xs text-[color:var(--pending)]">Demo on Sui testnet — no real money.</p>
      </div>
    </main>
  );
}
