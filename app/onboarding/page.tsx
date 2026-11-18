'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center"><p className="text-sm" role="status">Loading…</p></main>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [giftDigest, setGiftDigest] = useState<string | null>(null);

  // Step 1: create the key in the browser, register the address, drip the gift.
  useEffect(() => {
    if (step !== 1) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        const me = await fetch('/api/me').then((r) => r.json());
        if (!me.id) { router.push('/login'); return; }

        const kp = loadOrCreateWallet(me.id);
        const saved = await fetch('/api/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: kp.toSuiAddress() }),
        });
        const sj = await saved.json();
        if (!saved.ok) { setError(sj.error ?? 'Could not register your wallet.'); setBusy(false); return; }

        // Only drip on first-time (giftAt unset)
        if (!me.giftAt) {
          const drip = await fetch('/api/gift', { method: 'POST' });
          const dj = await drip.json().catch(() => ({}));
          if (!drip.ok) { setError(dj.error ?? 'Could not add test money.'); setBusy(false); return; }
          setGiftDigest(dj.digest ?? null);
        }
        setStep(2);
      } catch {
        setError('Something went wrong while preparing your account.');
      }
      setBusy(false);
    })();
  }, [step, router]);

  async function submitKyc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const r = await fetch('/api/kyc/basic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: f.get('country'),
        idType: f.get('idType'),
        idNumber: f.get('idNumber'),
        dateOfBirth: f.get('dob'),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? 'Could not save your verification.'); setBusy(false); return; }
    setStep(3);
    setBusy(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 flex flex-col gap-5" aria-live="polite">
        {step === 1 && (
          <section aria-labelledby="ob1">
            <h1 id="ob1" className="text-2xl font-bold">Create your account key</h1>
            <p className="text-sm text-[color:var(--ink-muted)] mt-2">
              Your key is generated in this browser and never leaves it. We register only your public address.
            </p>
            {busy && <p className="text-sm mt-4" role="status">Preparing your account…</p>}
            {error && <p role="alert" className="text-sm text-[color:var(--error)] mt-4">{error}</p>}
          </section>
        )}

        {step === 2 && (
          <form onSubmit={submitKyc} className="flex flex-col gap-4" aria-labelledby="ob2">
            <h1 id="ob2" className="text-2xl font-bold">Basic verification</h1>
            {giftDigest && (
              <p className="text-sm bg-[color:var(--ok-bg)] text-[color:var(--ok)] rounded-xl p-3">
                Your account is ready. We added $20 of test money.
              </p>
            )}

            <label className="text-sm font-medium" htmlFor="country">Country</label>
            <input id="country" name="country" className="field" required maxLength={60} defaultValue="Malaysia" />

            <label className="text-sm font-medium" htmlFor="idType">ID type</label>
            <select id="idType" name="idType" className="field" required>
              <option value="NRIC">NRIC (MyKad)</option>
              <option value="PASSPORT">Passport</option>
            </select>

            <label className="text-sm font-medium" htmlFor="idNumber">ID number</label>
            <input id="idNumber" name="idNumber" className="field" required minLength={4} maxLength={30} />
            <p className="text-xs text-[color:var(--ink-muted)]">Only the last 4 digits are stored.</p>

            <label className="text-sm font-medium" htmlFor="dob">Date of birth</label>
            <input id="dob" name="dob" type="date" className="field" required />

            <div className="border border-[color:var(--line)] rounded-xl p-4 text-sm text-[color:var(--ink-muted)]">
              Selfie verification is not available in this demo — a placeholder will be kept on file.
            </div>

            {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Verify'}</button>
          </form>
        )}

        {step === 3 && (
          <section aria-labelledby="ob3" className="text-center flex flex-col gap-4">
            <h1 id="ob3" className="text-2xl font-bold">You&apos;re all set</h1>
            <p className="text-sm text-[color:var(--ink-muted)]">
              Your wallet is ready, verification is done, and $20 of test money is in your account.
            </p>
            <button onClick={() => router.push(next)} className="btn-primary">Go to your dashboard</button>
          </section>
        )}

      </div>
    </main>
  );
}
