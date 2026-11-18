'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';
import { buildSendUsd } from '@/lib/sui/builders';
import { signAndRun } from '@/lib/sui/execute';
import { formatUsd } from '@/lib/sui/money';

type Me = { id?: string; name?: string; handle?: string } | null;

/** Pay button area: logged-in users sign & pay; visitors get inline sign-up first. */
export function PayRequestClient({ slug, amountMinor }: { slug: string; amountMinor: string }) {
  const [me, setMe] = useState<Me>(undefined as never);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'paid'>('idle');

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(j => setMe(j.id ? j : null)).catch(() => setMe(null));
  }, []);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const f = new FormData(e.currentTarget);
    // try login; if it fails, try signup (inline onboarding path: signup + gift happens on /onboarding)
    const lr = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
    });
    if (lr.ok) { window.location.reload(); return; }
    // signup with a generated handle
    const suffix = Math.floor(Math.random() * 100000);
    const su = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(f.get('name') || 'Guest'), email: f.get('email'), password: f.get('password'),
        handle: `payer${suffix}`, accountType: 'PERSONAL',
      }),
    });
    const sj = await su.json().catch(() => ({}));
    if (!su.ok) { setError(sj.error ?? 'Could not sign you up.'); setBusy(false); return; }
    // continue to onboarding to create the key, then come back
    window.location.href = `/onboarding?next=${encodeURIComponent(`/pay/${slug}`)}`;
  }

  async function pay() {
    setBusy(true); setError('');
    try {
      const meNow = await fetch('/api/me').then(r => r.json());
      if (!meNow.suiAddress) {
        window.location.href = `/onboarding?next=${encodeURIComponent(`/pay/${slug}`)}`;
        return;
      }
      const kp = loadOrCreateWallet(meNow.id);
      const tx = buildSendUsd({ sender: kp.toSuiAddress(), recipient: meNow.suiAddress, amountMinor: 0n }); // replaced below
      // Determine payee address from the request (public endpoint)
      const req = await fetch(`/api/public/requests/${slug}`).then(r => r.json());
      const payee = await fetch(`/api/users/resolve?handle=${encodeURIComponent(req.payeeHandle)}`).then(r => r.json());
      const tx2 = buildSendUsd({ sender: kp.toSuiAddress(), recipient: payee.address, amountMinor: BigInt(amountMinor) });
      const run = await signAndRun(kp, tx2);
      const c = await fetch('/api/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: run.digest, kind: 'REQUEST_PAYMENT', toAddress: payee.address,
          amountMinor, requestSlug: slug,
        }),
      });
      const j = await c.json();
      if (!c.ok) throw new Error(j.error ?? 'Could not record the payment.');
      setReceiptId(j.receiptId);
      setStatus('paid');
      void tx; // (first build was a dry shape check; removed above)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payment could not be completed.');
    }
    setBusy(false);
  }

  if (me === undefined) return <p className="text-sm" role="status">Loading…</p>;

  if (status === 'paid') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm rounded-xl p-3" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>Paid. Proof saved.</p>
        {receiptId && <a className="btn-primary text-center" href={`/receipt/${receiptId}`}>View receipt</a>}
      </div>
    );
  }

  if (!me) {
    return (
      <form onSubmit={signIn} className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-4" aria-label="Sign in to pay">
        <p className="text-sm font-medium">Sign in to pay this request</p>
        <input name="name" className="field" placeholder="Your name" required maxLength={80} />
        <input name="email" type="email" className="field" placeholder="Email" required autoComplete="email" />
        <input name="password" type="password" className="field" placeholder="Password (8+ characters)" required minLength={8} autoComplete="new-password" />
        {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Working…' : 'Continue'}</button>
        <p className="text-xs text-[color:var(--ink-muted)]">New here? We&apos;ll create your wallet next — your key stays in this browser.</p>
        <Link href="/login" className="text-xs underline text-center">Already have an account? Log in</Link>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
      <button className="btn-primary" onClick={pay} disabled={busy}>
        {busy ? 'Signing…' : `Pay ${formatUsd(BigInt(amountMinor))}`}
      </button>
      <p className="text-xs text-[color:var(--ink-muted)]">You sign this in your browser. Network fee: free on testnet.</p>
    </div>
  );
}
