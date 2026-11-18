'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Could not log in.'); setBusy(false); return; }
      router.push('/dashboard');
    } catch {
      setError('Could not log in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8 flex flex-col gap-4" aria-labelledby="login-h">
        <h1 id="login-h" className="text-2xl font-bold text-[color:var(--ink)]">Welcome back</h1>

        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

        {error && <p role="alert" className="text-sm text-[color:var(--error)]">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="text-sm text-[color:var(--ink-muted)] text-center">
          New to Arus? <Link href="/signup" className="underline">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
