'use client';

import { useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/hooks/use-portfolio';

type Tx = {
  id: string; kind: string; amountMinor: string; txDigest: string;
  direction: 'in' | 'out'; counterparty: string; createdAt: string; receiptId: string | null; note: string | null;
};

const FILTERS = [
  ['all', 'All'], ['in', 'In'], ['out', 'Out'], ['CASH_OUT', 'Cash out'], ['zeke', 'Zeke'],
] as const;

/** Activity: every payment involving my address, with filters and receipt links. */
export default function ActivityPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/activity').then(r => r.json()).then(j => setTxs(j.transactions ?? [])).catch(() => {});
  }, []);

  const shown = txs.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'in') return t.direction === 'in';
    if (filter === 'out') return t.direction === 'out';
    if (filter === 'CASH_OUT') return t.kind === 'CASH_OUT';
    if (filter === 'zeke') return t.note?.toLowerCase().includes('zeke') || t.note?.toLowerCase().includes('draft');
    return true;
  });

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
      <nav className="text-sm text-[color:var(--ink-muted)]"><a className="underline" href="/dashboard">← Back to Home</a></nav>
      <h1 className="text-xl font-bold">Activity</h1>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filter">
        {FILTERS.map(([f, label]) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`btn-secondary px-4 py-1.5 text-sm ${filter === f ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>
            {label}
          </button>
        ))}
      </div>
      <ul className="card p-4">
        {shown.length === 0 && <p className="text-sm text-[color:var(--ink-muted)]">Nothing here yet.</p>}
        {shown.map(t => (
          <li key={t.id} className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t.counterparty}</p>
              <p className="text-xs text-[color:var(--ink-muted)] tnum">
                {new Date(t.createdAt).toLocaleString()} · {t.kind.replaceAll('_', ' ').toLowerCase()}
                {t.receiptId && <> · <a className="underline" href={`/receipt/${t.receiptId}`}>receipt</a></>}
                {' · '}
                <a className="underline" href={`https://suiscan.xyz/testnet/tx/${t.txDigest}`} target="_blank" rel="noreferrer">tx</a>
              </p>
            </div>
            <p className={`text-sm font-semibold tnum ${t.direction === 'in' ? 'text-[color:var(--ok)]' : ''}`}>
              {t.direction === 'in' ? '+' : '−'}{fmtUsd(t.amountMinor)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
