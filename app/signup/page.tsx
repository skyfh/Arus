'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/** Signup: name, email, password, handle (live availability), account-type toggle. */
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [accountType, setAccountType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [businessName, setBusinessName] = useState('');
  const [handleState, setHandleState] = useState<{ ok: boolean | null; msg: string }>({ ok: null, msg: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkHandle(v: string) {
    setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    if (!v) { setHandleState({ ok: null, msg: '' }); return; }
    try {
      const r = await fetch(`/api/handles/check?h=${encodeURIComponent(v)}`);
      const j = await r.json();
      setHandleState({ ok: j.available === true, msg: j.error ?? (j.available ? 'Available!' : '') });
    } catch {
      setHandleState({ ok: null, msg: '' });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, handle, accountType, businessName: businessName || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Could not sign up.'); setBusy(false); return; }
      router.push('/onboarding');
    } catch {
      setError('Could not sign up. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8 flex flex-col gap-4" aria-labelledby="signup-h">
        <h1 id="signup-h" className="text-2xl font-bold text-[color:var(--ink)]">Create your Arus account</h1>

        <label className="text-sm font-medium" htmlFor="name">Full name</label>
        <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />

        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        <label className="text-sm font-medium" htmlFor="password">Password (8+ characters)</label>
        <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />

        <label className="text-sm font-medium" htmlFor="handle">Your handle</label>
        <div className="flex items-center gap-2">
          <input id="handle" className="field flex-1" value={handle} onChange={(e) => checkHandle(e.target.value)} required minLength={3} maxLength={20} pattern="[a-z0-9_]+" aria-describedby="handle-status" />
          <span className="text-sm text-[color:var(--ink-muted)]">@arus</span>
        </div>
        {handleState.msg && (
          <p id="handle-status" role="status" className={`text-sm ${handleState.ok ? 'text-[color:var(--ok)]' : 'text-[color:var(--error)]'}`}>{handleState.msg}</p>
        )}

        <fieldset className="flex gap-2">
          <legend className="sr-only">Account type</legend>
          {(['PERSONAL', 'BUSINESS'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAccountType(t)}
              aria-pressed={accountType === t}
              className={`btn-secondary flex-1 ${accountType === t ? 'border-[color:var(--gold)] text-[color:var(--gold-ink)] bg-[color:var(--gold-tint)]' : ''}`}
            >
              {t === 'PERSONAL' ? 'Personal' : 'Business'}
            </button>
          ))}
        </fieldset>
        {accountType === 'BUSINESS' && (
          <>
            <label className="text-sm font-medium" htmlFor="biz">Business name</label>
            <input id="biz" className="field" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required maxLength={80} />
          </>
        )}

        {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy || handleState.ok === false}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-sm text-[color:var(--ink-muted)] text-center">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}
