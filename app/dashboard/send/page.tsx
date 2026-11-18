'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';
import { buildSendUsd } from '@/lib/sui/builders';
import { signAndRun } from '@/lib/sui/execute';
import { usdToMinor, formatUsd } from '@/lib/sui/money';
import { toUsdMinor } from '@/lib/zeke/provenance';

type Resolved = { name: string; handle: string; address: string } | null;

function SendInner() {
  const params = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recipientInput, setRecipientInput] = useState(params.get('to') ?? '');
  const [resolved, setResolved] = useState<Resolved>(null);
  const [firstPayment, setFirstPayment] = useState(false);
  const [lookalike, setLookalike] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'MYR'>('USD');
  const [note, setNote] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  async function resolve() {
    setError('');
    const raw = recipientInput.trim().toLowerCase();
    const handle = raw.replace(/^@/, '').replace(/@arus$/, '');
    let res: Resolved = null;

    if (/^0x[0-9a-f]{64}$/.test(raw)) {
      res = { name: 'Address you typed', handle: '', address: normalizeSuiAddress(raw) };
    } else if (handle) {
      const r = await fetch(`/api/users/resolve?handle=${encodeURIComponent(handle)}`);
      if (r.ok) { const j = await r.json(); res = { name: j.name, handle: j.handle, address: j.address }; }
    }
    if (!res) { setError('No account found for that handle. Check the spelling.'); return; }

    // warnings: first payment, lookalike
    const act = await fetch('/api/activity').then(r => r.json());
    const past = (act.transactions ?? []).filter((t: { direction: string }) => t.direction === 'out');
    const seen = new Set<string>();
    setFirstPayment(!past.some((t: { counterparty: string }) => t.counterparty.includes(handle)));
    for (const t of past) { /* counterparties may be handles; addresses come from resolve only */ void t; void seen; }

    // lookalike against past on-chain counterparties
    const { lookalikeOf } = await import('@/lib/zeke/provenance');
    const pastAddrs = await fetch('/api/counterparties').then(r => r.json()).catch(() => ({ addresses: [] }));
    const lk = lookalikeOf(res.address, pastAddrs.addresses ?? []);
    setLookalike(lk);

    // fetch live MYR rate for currency toggle display
    const p = await fetch('/api/portfolio').then(r => r.json());
    setRate(p.fiat?.find((f: { currency: string }) => f.currency === 'MYR')?.rate ?? null);

    setResolved(res);
    setStep(2);
  }

  async function review() {
    setError('');
    try {
      const amt = currency === 'USD' ? usdToMinor(amount) : toUsdMinor(amount, 'MYR', rate);
      if (amt <= 0n) throw new Error('Enter an amount above zero.');
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the amount.'); }
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      const amt = currency === 'USD' ? usdToMinor(amount) : toUsdMinor(amount, 'MYR', rate);
      const tx = buildSendUsd({ sender: kp.toSuiAddress(), recipient: resolved!.address, amountMinor: amt });
      const run = await signAndRun(kp, tx);
      const c = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: run.digest, kind: 'SEND', toAddress: resolved!.address,
          amountMinor: amt.toString(), note: note || undefined,
        }),
      });
      const j = await c.json();
      if (!c.ok) throw new Error(j.error ?? 'Could not record the payment.');
      setReceiptId(j.receiptId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payment could not be completed.');
    }
    setBusy(false);
  }

  const amountUsd = () => {
    try {
      const minor = currency === 'USD' ? usdToMinor(amount) : toUsdMinor(amount, 'MYR', rate);
      return formatUsd(minor);
    } catch { return '—'; }
  };

  return (
    <main className="max-w-xl mx-auto p-6 flex flex-col gap-6">
      <nav aria-label="On this page" className="text-sm text-[color:var(--ink-muted)]">
        <Link href="/dashboard" className="underline">← Back to Home</Link> · Step {step} of 3
      </nav>

      {step === 1 && (
        <section className="card p-6 flex flex-col gap-4" aria-labelledby="send-h1">
          <h1 id="send-h1" className="text-xl font-bold">Send money</h1>
          <label className="text-sm font-medium" htmlFor="to">Recipient</label>
          <input id="to" className="field" placeholder="@handle or a Sui address" value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)} />
          {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
          <button className="btn-primary" onClick={resolve}>Continue</button>
        </section>
      )}

      {step === 2 && resolved && (
        <section className="card p-6 flex flex-col gap-4" aria-labelledby="send-h2">
          <h1 id="send-h2" className="text-xl font-bold">Sending to</h1>
          <p className="text-2xl font-bold">{resolved.name}</p>
          {resolved.handle && <p className="text-sm text-[color:var(--ink-muted)] tnum">@{resolved.handle}@arus</p>}
          {!resolved.handle && <p className="text-xs tnum break-all text-[color:var(--ink-muted)]">{resolved.address}</p>}

          {firstPayment && (
            <p className="text-sm rounded-xl p-3" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              First payment to this person
            </p>
          )}
          {lookalike && (
            <p className="text-sm rounded-xl p-3" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
              This address looks like someone you paid before — double-check every character.
            </p>
          )}

          <div className="flex gap-2" role="group" aria-label="Currency">
            {(['USD', 'MYR'] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)} aria-pressed={currency === c}
                className={`btn-secondary px-4 py-1.5 text-sm ${currency === c ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>{c}</button>
            ))}
          </div>
          <label className="text-sm font-medium" htmlFor="amt">Amount ({currency === 'MYR' ? 'RM' : '$'})</label>
          <input id="amt" className="field tnum" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.50" />
          {currency === 'MYR' && rate !== null && amount && (
            <p className="text-xs text-[color:var(--ink-muted)] tnum">≈ {amountUsd()} · live rate {rate}</p>
          )}
          <label className="text-sm font-medium" htmlFor="note">Note (optional)</label>
          <input id="note" className="field" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
          <button className="btn-primary" onClick={review}>Review</button>
        </section>
      )}

      {step === 3 && resolved && (
        <section className="card p-6 flex flex-col gap-4" aria-labelledby="send-h3">
          <h1 id="send-h3" className="text-xl font-bold">Review · confirm to send</h1>
          <p className="text-3xl font-bold tnum">{amountUsd()}</p>
          <p className="text-sm">To <strong>{resolved.name}</strong> {resolved.handle && <span className="tnum">@{resolved.handle}@arus</span>}</p>
          {note && <p className="text-sm text-[color:var(--ink-muted)]">Note: {note}</p>}
          <p className="text-xs text-[color:var(--ink-muted)]">Network fee: free on testnet. You sign this in your browser.</p>
          {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
          {!receiptId && (
            <div className="flex gap-3">
              <button className="btn-primary flex-1" onClick={confirm} disabled={busy}>{busy ? 'Signing…' : 'Confirm'}</button>
              <button className="btn-secondary flex-1" onClick={() => setStep(2)} disabled={busy}>Edit</button>
            </div>
          )}
          {receiptId && (
            <>
              <p className="text-sm bg-[color:var(--ok-bg)] text-[color:var(--ok)] rounded-xl p-3">Sent. Proof saved.</p>
              <a className="btn-primary text-center" href={`/receipt/${receiptId}`}>View receipt</a>
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={<main className="max-w-xl mx-auto p-6"><p className="text-sm" role="status">Loading…</p></main>}>
      <SendInner />
    </Suspense>
  );
}
