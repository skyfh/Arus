'use client';

import { useEffect, useState } from 'react';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';
import { buildCreateAllowance, buildRevokeAllowance, buildDrawAllowance } from '@/lib/sui/builders';
import { signAndRun, allowanceIdsFrom } from '@/lib/sui/execute';
import { usdToMinor, formatUsd } from '@/lib/sui/money';

type Row = {
  id: string; spenderAddress: string; spenderLabel: string; name: string;
  monthlyLimitMinor: string; expiresAt: string; allowanceObjectId: string; capObjectId: string;
};

/** Allowances: give (person, limit, end date), what I give (cancel), what I receive (take money). */
export default function AllowancesPage() {
  const [given, setGiven] = useState<Row[]>([]);
  const [received, setReceived] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ handle: '', label: '', limit: '', endDate: '' });

  const load = () => fetch('/api/allowances').then(r => r.json()).then(j => {
    setGiven(j.allowancesGiven ?? []); setReceived(j.allowancesReceived ?? []);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function give(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('');
    try {
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      // Resolve spender address first (server can also verify)
      let spenderAddr = form.handle;
      if (form.handle.startsWith('@') || /^[a-z0-9_]{3,20}$/.test(form.handle)) {
        const r = await fetch(`/api/users/resolve?handle=${encodeURIComponent(form.handle)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'No account found for that handle.');
        spenderAddr = j.address;
      }
      const tx = buildCreateAllowance({
        funder: kp.toSuiAddress(),
        spender: spenderAddr,
        name: `${form.label} — monthly`,
        monthlyLimitMinor: usdToMinor(form.limit),
        expiresAtMs: new Date(form.endDate + 'T23:59:59Z').getTime(),
      });
      const run = await signAndRun(kp, tx);
      const ids = allowanceIdsFrom(run);
      const reg = await fetch('/api/allowances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: form.handle.startsWith('@') || /^[a-z0-9_]{3,20}$/.test(form.handle) ? form.handle : undefined,
          address: form.handle.startsWith('@') || /^[a-z0-9_]{3,20}$/.test(form.handle) ? undefined : form.handle,
          spenderLabel: form.label, monthlyLimit: form.limit, endDate: form.endDate,
          digest: run.digest, allowanceId: ids.allowanceId, capObjectId: ids.capId,
        }),
      });
      const j = await reg.json();
      if (!reg.ok) throw new Error(j.error ?? 'Could not register the allowance.');
      setMsg('Allowance created. The Sui network enforces the limit, not Arus.');
      setForm({ handle: '', label: '', limit: '', endDate: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the allowance.');
    }
    setBusy(false);
  }

  async function cancel(row: Row) {
    setBusy(true); setError(''); setMsg('');
    try {
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      const tx = buildRevokeAllowance({ funder: kp.toSuiAddress(), allowanceId: row.allowanceObjectId, capId: row.capObjectId });
      const run = await signAndRun(kp, tx);
      const c = await fetch(`/api/allowances/${row.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest: run.digest }),
      });
      const j = await c.json();
      if (!c.ok) throw new Error(j.error ?? 'Could not cancel.');
      setMsg('Allowance cancelled.');
      load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel.'); }
    setBusy(false);
  }

  async function take(row: Row) {
    setBusy(true); setError(''); setMsg('');
    try {
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      const amt = prompt(`How much USD to take from ${row.spenderLabel}? (limit ${formatUsd(row.monthlyLimitMinor)}/month)`);
      if (!amt) { setBusy(false); return; }
      const tx = buildDrawAllowance({
        spender: kp.toSuiAddress(), funder: '', // funder resolved on chain; builder needs the funder address
        allowanceId: row.allowanceObjectId, amountMinor: usdToMinor(amt),
      });
      // The builder requires the funder address; fetch it from the allowance row's createTx sender.
      // For this build the funder is whoever created it; we stored only their id. Use the API to fetch.
      const f = await fetch(`/api/allowances/${row.id}/funder`).then(r => r.json());
      const tx2 = buildDrawAllowance({ spender: kp.toSuiAddress(), funder: f.funderAddress, allowanceId: row.allowanceObjectId, amountMinor: usdToMinor(amt) });
      const run = await signAndRun(kp, tx2);
      await fetch('/api/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: run.digest, kind: 'ALLOWANCE_DRAW', toAddress: kp.toSuiAddress(),
          amountMinor: usdToMinor(amt).toString(), allowanceId: row.id,
        }),
      });
      setMsg(`You took ${formatUsd(usdToMinor(amt))}.`);
      load();
      void tx;
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not take the money.'); }
    setBusy(false);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-5">
      <nav className="text-sm text-[color:var(--ink-muted)]"><a className="underline" href="/dashboard">← Back to Home</a></nav>
      <h1 className="text-xl font-bold">Allowances</h1>
      <p className="text-sm text-[color:var(--ink-muted)]">The limit is enforced by the Sui network, not by Arus.</p>

      <section className="card p-6" aria-labelledby="give-h">
        <h2 id="give-h" className="text-base font-semibold mb-3">Give an allowance</h2>
        <form onSubmit={give} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="who">Person (@handle or address)</label>
          <input id="who" className="field" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} required placeholder="@mak" />
          <label className="text-sm font-medium" htmlFor="lbl">Label (shown to you)</label>
          <input id="lbl" className="field" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required placeholder="Mak" />
          <label className="text-sm font-medium" htmlFor="lim">Monthly limit (USD)</label>
          <input id="lim" className="field tnum" inputMode="decimal" value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} required placeholder="30" />
          <label className="text-sm font-medium" htmlFor="end">End date</label>
          <input id="end" type="date" className="field" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Working…' : 'Create allowance'}</button>
        </form>
      </section>

      {msg && <p className="text-sm rounded-xl p-3" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }} role="status">{msg}</p>}
      {error && <p className="text-sm rounded-xl p-3" style={{ background: 'var(--error-bg)', color: 'var(--error)' }} role="alert">{error}</p>}

      <section className="card p-6" aria-labelledby="giveng-h">
        <h2 id="giveng-h" className="text-base font-semibold mb-3">You give</h2>
        {given.length === 0 && <p className="text-sm text-[color:var(--ink-muted)]">No active allowances.</p>}
        {given.map(r => (
          <div key={r.id} className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
            <div>
              <p className="text-sm font-medium">{r.spenderLabel}</p>
              <p className="text-xs text-[color:var(--ink-muted)] tnum">{formatUsd(r.monthlyLimitMinor)}/month · until {new Date(r.expiresAt).toLocaleDateString()}</p>
            </div>
            <button className="btn-secondary px-3 py-1 text-xs" onClick={() => cancel(r)} disabled={busy}>Cancel</button>
          </div>
        ))}
      </section>

      <section className="card p-6" aria-labelledby="recvh">
        <h2 id="recvh" className="text-base font-semibold mb-3">You receive</h2>
        {received.length === 0 && <p className="text-sm text-[color:var(--ink-muted)]">Nobody gives you an allowance yet.</p>}
        {received.map(r => (
          <div key={r.id} className="flex items-center justify-between py-3 border-b border-[color:var(--line)] last:border-0">
            <div>
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-[color:var(--ink-muted)] tnum">{formatUsd(r.monthlyLimitMinor)}/month · until {new Date(r.expiresAt).toLocaleDateString()}</p>
            </div>
            <button className="btn-primary px-3 py-1 text-xs" onClick={() => take(r)} disabled={busy}>Take money</button>
          </div>
        ))}
      </section>
    </main>
  );
}
