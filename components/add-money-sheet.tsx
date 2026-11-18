'use client';

import { useState } from 'react';

type Method = 'APPLE_PAY' | 'CARD' | 'HALLIDAY' | 'HATA';
const OPTIONS = [10_000_000n, 20_000_000n, 50_000_000n];
const LABELS = ['$10', '$20', '$50'];

/** Add money sheet: demo pay methods + transfer-in address/QR. Polls portfolio every 5s when open. */
export function AddMoneySheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'pay' | 'transfer'>('pay');
  const [method, setMethod] = useState<Method>('APPLE_PAY');
  const [amountIdx, setAmountIdx] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const [address, setAddress] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [received, setReceived] = useState(false);

  async function openTransfer() {
    setMode('transfer');
    const me = await fetch('/api/me').then(r => r.json());
    setAddress(me.suiAddress);
    const p = await fetch('/api/portfolio').then(r => r.json());
    setBaseline(p.usdMinor);
    // poll 5s while open: show "USD received" toast when balance changes
    const t = setInterval(async () => {
      const q = await fetch('/api/portfolio').then(r => r.json());
      if (baseline !== null && q.usdMinor !== baseline) { setReceived(true); clearInterval(t); }
    }, 5000);
    setTimeout(() => clearInterval(t), 5 * 60_000);
  }

  async function pay() {
    setBusy(true); setError('');
    const r = await fetch('/api/add-money/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, amountMinor: OPTIONS[amountIdx].toString() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? 'Top-up failed. Nothing was added.'); setBusy(false); return; }
    setDone(j.digest); setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add money">
      <div className="card w-full max-w-md p-6 flex flex-col gap-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add money</h2>
          <button onClick={onClose} aria-label="Close" className="btn-secondary px-3 py-1">✕</button>
        </div>

        {done ? (
          <>
            <p className="text-sm bg-[color:var(--ok-bg)] text-[color:var(--ok)] rounded-xl p-3">
              Money added. <a className="underline" href={`https://suiscan.xyz/testnet/tx/${done}`} target="_blank" rel="noreferrer">View transaction</a>
            </p>
            <button className="btn-primary" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <div className="flex gap-2" role="tablist" aria-label="Add money method">
              {(['pay', 'transfer'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m}
                  onClick={() => (m === 'pay' ? setMode('pay') : openTransfer())}
                  className={`btn-secondary px-4 py-1.5 text-sm ${mode === m ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>
                  {m === 'pay' ? 'Pay with (Demo)' : 'Transfer in'}
                </button>
              ))}
            </div>

            {mode === 'pay' ? (
              <>
                <fieldset>
                  <legend className="text-sm font-medium mb-2">Pay with</legend>
                  <div className="flex flex-col gap-2">
                    {([['APPLE_PAY', 'Apple Pay'], ['CARD', 'Debit or credit card'], ['HALLIDAY', 'Halliday'], ['HATA', 'From Hata (Demo)']] as const).map(([m, label]) => (
                      <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                        className={`btn-secondary text-left ${method === m ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-medium mb-2">Amount</legend>
                  <div className="flex gap-2">
                    {OPTIONS.map((o, i) => (
                      <button key={o.toString()} onClick={() => setAmountIdx(i)} aria-pressed={amountIdx === i}
                        className={`btn-secondary flex-1 tnum ${amountIdx === i ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}>
                        {LABELS[i]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {method === 'CARD' && (
                  <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                    <p className="font-medium">Demo card</p>
                    <p className="tnum text-[color:var(--ink-muted)] mt-1">4242 4242 4242 4242 · any future date · any CVC</p>
                    <p className="text-xs text-[color:var(--ink-muted)] mt-2">Demo card — nothing is charged.</p>
                  </div>
                )}
                {method === 'APPLE_PAY' && (
                  <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                    <p className="font-medium">Apple Pay</p>
                    <p className="text-xs text-[color:var(--ink-muted)] mt-1">Demo sheet — confirm to continue.</p>
                  </div>
                )}
                {method === 'HALLIDAY' && (
                  <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                    <p className="font-medium">Halliday</p>
                    <p className="text-xs text-[color:var(--ink-muted)] mt-1">Demo provider list — pick any to continue.</p>
                  </div>
                )}
                {method === 'HATA' && (
                  <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                    <p className="font-medium">From Hata (Demo)</p>
                    <p className="text-xs text-[color:var(--ink-muted)] mt-1">Simulated transfer-in for the demo.</p>
                  </div>
                )}

                {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
                <button className="btn-primary" onClick={pay} disabled={busy}>
                  {busy ? 'Processing…' : `Pay ${LABELS[amountIdx]} (Demo)`}
                </button>
              </>
            ) : (
              <>
                {address && (
                  <>
                    <p className="text-sm font-medium">Your address</p>
                    <p className="text-xs tnum break-all bg-[color:var(--surface-2)] rounded-xl p-3" aria-label="Wallet address">{address}</p>
                    <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                      <p className="font-medium">From any wallet (Live)</p>
                      <p className="text-xs text-[color:var(--error)] mt-1">Send only USDC on the Sui network.</p>
                      <p className="text-xs text-[color:var(--ink-muted)] mt-1">We watch your balance and tell you when USD arrives.</p>
                    </div>
                    <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm">
                      <p className="font-medium">From Hata (Demo)</p>
                      <p className="text-xs text-[color:var(--ink-muted)] mt-1">Copy the address, paste it in Hata, and send USDC. Simulated for the demo.</p>
                    </div>
                    {received && (
                      <p className="text-sm bg-[color:var(--ok-bg)] text-[color:var(--ok)] rounded-xl p-3" role="status">USD received.</p>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
