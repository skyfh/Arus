'use client';

import { useEffect, useState } from 'react';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';
import { buildSendUsd } from '@/lib/sui/builders';
import { signAndRun } from '@/lib/sui/execute';
import { formatUsd } from '@/lib/sui/money';

type Destination = 'RYT_BANK' | 'TNG_EWALLET' | 'OTHER_DUITNOW' | 'JOMPAY_BILL';
const BANKS = ['Maybank', 'CIMB', 'Public Bank', 'RHB', 'Hong Leong', 'AmBank', 'Bank Islam', 'BSN', 'GXBank', 'Boost Bank', 'AEON Bank'];

type Quote = {
  quote: { amountMinor: string; feeMinor: string; netMinor: string; rate: number; myrSen: string; destination: Destination; accountId: string | null; billerCode: string | null; billRef: string | null };
  token: string; signature: string; expiresInSec: number;
};
type TimelineStep = { label: string; simulated: boolean; done?: boolean; txDigest?: string; afterSec?: number };

const fmtSen = (sen: string) => `RM ${(BigInt(sen) / 100n).toLocaleString('en-US')}.${(BigInt(sen) % 100n).toString().padStart(2, '0')}`;

/** Cash out, 4 steps: account → where to → amount & quote → confirm with timeline. */
export default function CashOutPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [exchangeLinked, setExchangeLinked] = useState<boolean | null>(null);
  const [destination, setDestination] = useState<Destination>('TNG_EWALLET');
  const [bankName, setBankName] = useState(BANKS[0]);
  const [accountId, setAccountId] = useState('');
  const [billerCode, setBillerCode] = useState('');
  const [billRef, setBillRef] = useState('');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cashOutId, setCashOutId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [digest, setDigest] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/exchange-link').then(r => r.json()).then(j => setExchangeLinked(j.status === 'LINKED')).catch(() => setExchangeLinked(false));
  }, []);

  useEffect(() => {
    if (!quote || countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [quote, countdown]);

  useEffect(() => {
    if (!cashOutId) return;
    const t = setInterval(async () => {
      const j = await fetch(`/api/cashout/${cashOutId}`).then(r => r.json());
      if (j.steps) setSteps(j.steps);
    }, 2000);
    return () => clearInterval(t);
  }, [cashOutId]);

  async function confirm() {
    setBusy(true); setError('');
    try {
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      const DEPOSIT = process.env.NEXT_PUBLIC_DEMO_EXCHANGE_DEPOSIT_ADDRESS!;
      const tx = buildSendUsd({ sender: kp.toSuiAddress(), recipient: DEPOSIT, amountMinor: BigInt(quote!.quote.amountMinor) });
      const run = await signAndRun(kp, tx);
      setDigest(run.digest);
      const c = await fetch('/api/cashout/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: quote!.token, signature: quote!.signature, digest: run.digest }),
      });
      const j = await c.json();
      if (!c.ok) throw new Error(j.error ?? 'The cash-out could not be completed.');
      setCashOutId(j.id); setSteps(j.steps); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : 'The cash-out failed.'); }
    setBusy(false);
  }

  async function getQuote() {
    setBusy(true); setError('');
    const r = await fetch('/api/cashout/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount, destination,
        accountId: destination === 'JOMPAY_BILL' ? undefined : accountId,
        billerCode: destination === 'JOMPAY_BILL' ? billerCode : undefined,
        billRef: destination === 'JOMPAY_BILL' ? billRef : undefined,
        bankName: destination === 'OTHER_DUITNOW' ? bankName : undefined,
      }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error ?? 'Could not get a quote.'); setBusy(false); return; }
    setQuote(j); setCountdown(j.expiresInSec); setStep(3); setBusy(false);
  }

  const q = quote?.quote;

  return (
    <main className="max-w-xl mx-auto p-6 flex flex-col gap-5">
      <nav className="text-sm text-[color:var(--ink-muted)]"><a className="underline" href="/dashboard">← Back to Home</a></nav>
      <h1 className="text-xl font-bold">Cash out</h1>
      <p className="text-xs text-[color:var(--warn)]">
        Ringgit payouts and bill payments are simulated in this demo. Conversion is done by a Securities Commission–registered exchange, not by Arus.
      </p>

      {step === 1 && (
        <section className="card p-6 flex flex-col gap-3" aria-labelledby="co1">
          <h2 id="co1" className="text-base font-semibold">Step 1 · Your payout account</h2>
          {exchangeLinked === null && <p className="text-sm" role="status">Checking…</p>}
          {exchangeLinked === false && (
            <>
              <p className="text-sm text-[color:var(--ink-muted)]">PERSONAL accounts link a demo exchange account first.</p>
              <button className="btn-primary" onClick={async () => {
                await fetch('/api/exchange-link', { method: 'POST' });
                await fetch('/api/exchange-link/simulate', { method: 'POST' });
                setExchangeLinked(true);
              }}>Simulate approval</button>
            </>
          )}
          {exchangeLinked === true && (
            <>
              <p className="text-sm" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', borderRadius: 12, padding: 10 }}>Exchange account linked (demo).</p>
              <button className="btn-primary" onClick={() => setStep(2)}>Continue</button>
            </>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card p-6 flex flex-col gap-3" aria-labelledby="co2">
          <h2 id="co2" className="text-base font-semibold">Step 2 · Where to</h2>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Destination">
            {([['RYT_BANK', 'Ryt Bank (account number)'], ['TNG_EWALLET', "Touch 'n Go eWallet (mobile number)"], ['OTHER_DUITNOW', 'Other DuitNow bank'], ['JOMPAY_BILL', 'Pay a bill (JomPAY)']] as const).map(([d, label]) => (
              <button key={d} onClick={() => setDestination(d)} aria-pressed={destination === d}
                className={`btn-secondary text-left ${destination === d ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>{label}</button>
            ))}
          </div>
          {destination === 'OTHER_DUITNOW' && (
            <>
              <label className="text-sm font-medium" htmlFor="bank">Bank</label>
              <select id="bank" className="field" value={bankName} onChange={e => setBankName(e.target.value)}>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </>
          )}
          {destination !== 'JOMPAY_BILL' && (
            <>
              <label className="text-sm font-medium" htmlFor="acct">{destination === 'TNG_EWALLET' ? 'Mobile number' : 'Account number'}</label>
              <input id="acct" className="field tnum" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder={destination === 'TNG_EWALLET' ? '012-3456789' : '1622xxxxxxxx'} />
            </>
          )}
          {destination === 'JOMPAY_BILL' && (
            <>
              <label className="text-sm font-medium" htmlFor="bc">Biller code (4–6 digits)</label>
              <input id="bc" className="field tnum" value={billerCode} onChange={e => setBillerCode(e.target.value)} placeholder="5454" />
              <label className="text-sm font-medium" htmlFor="br">Ref-1</label>
              <input id="br" className="field tnum" value={billRef} onChange={e => setBillRef(e.target.value)} placeholder="1234567890" />
            </>
          )}
          {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
          <button className="btn-primary" onClick={() => { setError(''); setStep(3); setQuote(null); }}>Continue</button>
        </section>
      )}

      {step === 3 && (
        <section className="card p-6 flex flex-col gap-3" aria-labelledby="co3">
          <h2 id="co3" className="text-base font-semibold">Step 3 · Amount and quote</h2>
          <label className="text-sm font-medium" htmlFor="amt">Amount (USD)</label>
          <input id="amt" className="field tnum" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="22.68" />
          {!quote && <button className="btn-primary" onClick={getQuote} disabled={busy}>{busy ? 'Quoting…' : 'Get quote'}</button>}
          {q && (
            <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tnum">
              <dt>Amount</dt><dd>{formatUsd(BigInt(q.amountMinor))}</dd>
              <dt>Fee (0.30%)</dt><dd>−{formatUsd(BigInt(q.feeMinor))}</dd>
              <dt className="font-semibold">You receive</dt><dd className="font-semibold">{fmtSen(q.myrSen)}</dd>
            </dl>
          )}
          {quote && countdown > 0 && <p className="text-xs text-[color:var(--warn)] tnum" role="timer">Quote valid for {countdown}s</p>}
          {quote && countdown <= 0 && <p className="text-sm text-[color:var(--error)]" role="alert">The quote expired. Get a new one.</p>}
          {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
          {quote && countdown > 0 && <button className="btn-primary" onClick={() => setStep(3)}>Review & confirm</button>}
          {quote && countdown > 0 && <button className="btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Signing…' : 'Confirm cash out'}</button>}
        </section>
      )}

      {step === 4 && (
        <section className="card p-6 flex flex-col gap-3" aria-labelledby="co4">
          <h2 id="co4" className="text-base font-semibold">Step 4 · Status</h2>
          <ul className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-sm">{s.label} {s.simulated && <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>Simulated payout</span>}</span>
                <span className={`text-sm font-medium ${s.done ? 'text-[color:var(--ok)]' : 'text-[color:var(--pending)]'}`}>{s.done ? '✓' : '…'}</span>
              </li>
            ))}
          </ul>
          {digest && <a className="text-xs underline tnum" href={`https://suiscan.xyz/testnet/tx/${digest}`} target="_blank" rel="noreferrer">View transaction</a>}
          <p className="text-xs text-[color:var(--ink-muted)]">The timeline refreshes automatically. Conversion and payout are simulated.</p>
        </section>
      )}
    </main>
  );
}
