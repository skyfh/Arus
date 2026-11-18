'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { explorerTxUrl } from '@/lib/sui/config';
import { fmtUsd, fmtGas, usePortfolio } from '@/lib/hooks/use-portfolio';
import { AddMoneySheet } from '@/components/add-money-sheet';

type Tx = {
  id: string;
  kind: string;
  amountMinor: string;
  txDigest: string;
  direction: 'in' | 'out';
  counterparty: string;
  createdAt: string;
  receiptId: string | null;
  note: string | null;
};

function TxRow({ tx }: { tx: Tx }) {
  const isIn = tx.direction === 'in';
  return (
    <li className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{tx.counterparty}</p>
        <p className="text-xs text-[color:var(--ink-muted)] tnum">
          {new Date(tx.createdAt).toLocaleString()} · {tx.kind.replaceAll('_', ' ').toLowerCase()}
          {tx.receiptId && <> · <a href={`/receipt/${tx.receiptId}`} className="underline">receipt</a></>}
        </p>
      </div>
      <p className={`text-sm font-semibold tnum ${isIn ? 'text-[color:var(--ok)]' : 'text-[color:var(--ink)]'}`}>
        {isIn ? '+' : '−'}{fmtUsd(tx.amountMinor)}
      </p>
    </li>
  );
}

/** Home: balance card, action row, fiat/crypto tabs, needs-you, recent activity. */
export function HomeTab() {
  const { data, error, loading } = usePortfolio(10_000);
  const [tab, setTab] = useState<'fiat' | 'crypto'>('fiat');
  const [hidden, setHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    try { const t = localStorage.getItem('arus.home.tab'); if (t === 'crypto') setTab('crypto'); } catch { /* private mode */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('arus.home.tab', tab); } catch { /* private mode */ }
  }, [tab]);

  useEffect(() => {
    fetch('/api/activity').then(r => r.json()).then(j => { if (j.transactions) setTxs(j.transactions); }).catch(() => {});
  }, [data?.usdMinor]);

  if (loading) return <p className="text-sm text-[color:var(--ink-muted)]" role="status">Loading your balance…</p>;
  if (error || !data) return <p className="text-sm text-[color:var(--error)]" role="alert">{error || 'Could not load your balance.'}</p>;

  const gas = BigInt(data.gasMist);
  const usdMinor = BigInt(data.usdMinor);
  const myr = data.fiat.find(f => f.currency === 'MYR');

  return (
    <div className="flex flex-col gap-6">
      {/* Balance card */}
      <section className="panel-deep p-8 text-white" aria-label="Balance">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">Total balance</p>
            <p className="text-4xl font-bold tnum mt-1">{hidden ? '••••' : data.usdFormatted}</p>
            {myr && <p className="text-sm opacity-80 tnum mt-1">{hidden ? '••••' : `≈ ${myr.formatted}`}</p>}
          </div>
          <button onClick={() => setHidden(!hidden)} aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
            className="rounded-full bg-white/15 px-3 py-2 text-sm">{hidden ? '👁' : '🙈'}</button>
        </div>
        <div className="relative z-10 flex gap-2 mt-4">
          <span className="rounded-full bg-[color:var(--ok)] px-3 py-1 text-xs font-medium">Basic verified</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs">Testnet</span>
        </div>
      </section>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label="Quick actions">
        <button className="btn-secondary" onClick={() => setAddOpen(true)}>Add money</button>
        <a className="btn-secondary text-center" href="/dashboard/send">Send</a>
        <a className="btn-secondary text-center" href="/dashboard/requests">Request</a>
        <a className="btn-secondary text-center" href="/dashboard/cashout">Cash out</a>
        <a className="btn-secondary text-center" href="/dashboard/zeke">Ask Zeke</a>
      </div>

      {/* Fiat / crypto tabs */}
      <section className="card p-6" aria-label="Balances">
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Balance view">
          {(['fiat', 'crypto'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`btn-secondary px-4 py-1.5 text-sm ${tab === t ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>
              {t === 'fiat' ? 'Fiat' : 'Crypto'}
            </button>
          ))}
        </div>

        {tab === 'fiat' ? (
          <>
            <ul className="flex flex-col">
              <li className="flex items-center justify-between py-3 border-b border-[color:var(--line)]">
                <span className="text-sm font-medium">USD — Your balance</span>
                <span className="text-sm font-semibold tnum">{hidden ? '••••' : data.usdFormatted}</span>
              </li>
              {data.fiat.map((f) => (
                <li key={f.currency} className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
                  <span className="text-sm">{f.currency} <span className="text-[color:var(--ink-muted)]">· {f.name}</span></span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm tnum">{hidden ? '••••' : f.formatted}</span>
                    {f.cashOut === 'live'
                      ? <a href="/dashboard/cashout" className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>Cash out</a>
                      : <span className="rounded-full px-3 py-1 text-xs" style={{ background: 'var(--pending-bg)', color: 'var(--pending)' }}>Coming soon</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[color:var(--ink-muted)] mt-3">
              One USD balance, shown in each currency at today&apos;s rate · Rates from {data.ratesSource}, {new Date(data.ratesAt).toLocaleTimeString()}
            </p>
          </>
        ) : (
          <ul className="flex flex-col">
            <li className="flex items-center justify-between py-3 border-b border-[color:var(--line)]">
              <span>
                <p className="text-sm font-medium">USDC on Sui</p>
                <p className="text-xs text-[color:var(--ink-muted)]">Your balance, shown as a token</p>
              </span>
              <span className="text-sm font-semibold tnum">{hidden ? '••••' : data.usdFormatted}</span>
            </li>
            <li className="flex items-center justify-between py-3">
              <span>
                <p className="text-sm font-medium">Network fees</p>
                <p className="text-xs text-[color:var(--ink-muted)]">Used for network fees. Topped up for you on testnet.</p>
              </span>
              <span className="text-sm tnum">{fmtGas(data.gasMist)}</span>
            </li>
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="card p-6" aria-label="Recent activity">
        <h2 className="text-base font-semibold mb-2">Recent activity</h2>
        {txs.length === 0
          ? <p className="text-sm text-[color:var(--ink-muted)]">No payments yet. Add money to get started.</p>
          : <ul>{txs.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} />)}</ul>}
      </section>

      {addOpen && <AddMoneySheet onClose={() => setAddOpen(false)} />}
    </div>
  );
}
