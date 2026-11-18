'use client';

import { useEffect, useState } from 'react';
import { fmtUsd } from '@/lib/hooks/use-portfolio';

type Req = {
  id: string; slug: string; number: string; amountMinor: string;
  description: string; payerName: string | null; status: string; createdAt: string;
};

/** Get paid: requests list, new request dialog, copy link / QR / cancel. */
export default function RequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [payerName, setPayerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => fetch('/api/requests').then(r => r.json()).then(j => setRows(j.requests ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const r = await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description, payerName: payerName || undefined, dueDate: dueDate || undefined }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error ?? 'Could not create the request.'); setBusy(false); return; }
    setOpen(false); setAmount(''); setDescription(''); setPayerName(''); setDueDate('');
    setBusy(false); load();
  }

  async function cancel(id: string) {
    await fetch(`/api/requests/${id}/cancel`, { method: 'POST' });
    load();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(slug); setTimeout(() => setCopied(null), 1500); });
  }

  const statusChip = (s: string) => {
    if (s === 'PAID') return { bg: 'var(--ok-bg)', fg: 'var(--ok)', label: 'Paid' };
    if (s === 'CANCELLED') return { bg: 'var(--pending-bg)', fg: 'var(--pending)', label: 'Cancelled' };
    return { bg: 'var(--gold-tint)', fg: 'var(--gold-ink)', label: 'Open' };
  };

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
      <nav className="text-sm text-[color:var(--ink-muted)]"><a className="underline" href="/dashboard">← Back to Home</a></nav>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Get paid</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>New request</button>
      </div>

      <ul className="card p-4">
        {rows.length === 0 && <p className="text-sm text-[color:var(--ink-muted)]">No requests yet. Create one to get paid.</p>}
        {rows.map(r => {
          const chip = statusChip(r.status);
          return (
            <li key={r.id} className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium tnum">{r.number} · {fmtUsd(r.amountMinor)}</p>
                <p className="text-xs text-[color:var(--ink-muted)] truncate">{r.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: chip.bg, color: chip.fg }}>{chip.label}</span>
                <button className="btn-secondary px-3 py-1 text-xs" onClick={() => copyLink(r.slug)}>{copied === r.slug ? 'Copied!' : 'Copy link'}</button>
                {r.status === 'OPEN' && <button className="btn-secondary px-3 py-1 text-xs" onClick={() => cancel(r.id)}>Cancel</button>}
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New request">
          <form onSubmit={create} className="card w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">New request</h2>
            <label className="text-sm font-medium" htmlFor="amt">Amount (USD)</label>
            <input id="amt" className="field tnum" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="50" />
            <label className="text-sm font-medium" htmlFor="desc">Description</label>
            <input id="desc" className="field" maxLength={140} value={description} onChange={e => setDescription(e.target.value)} required placeholder="Logo design" />
            <label className="text-sm font-medium" htmlFor="payer">Payer name (optional)</label>
            <input id="payer" className="field" maxLength={80} value={payerName} onChange={e => setPayerName(e.target.value)} />
            <label className="text-sm font-medium" htmlFor="due">Due date (optional)</label>
            <input id="due" type="date" className="field" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
