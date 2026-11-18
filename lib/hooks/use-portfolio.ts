'use client';

import { useEffect, useState } from 'react';
import { CURRENCY_META } from '@/lib/fx';

export type Portfolio = {
  usdMinor: string;
  usdFormatted: string;
  gasMist: string;
  fiat: { currency: string; symbol: string; name: string; cashOut: 'live' | 'soon'; formatted: string; rate: number | null }[];
  ratesAt: string;
  ratesSource: string;
};

/** Hook: fetch /api/portfolio and poll while `pollMs` is set (e.g. Add money sheet open). */
export function usePortfolio(pollMs?: number) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch('/api/portfolio');
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) { setError(j.error ?? 'Could not load your balance.'); setLoading(false); return; }
        setData(j); setError(''); setLoading(false);
      } catch { if (alive) setLoading(false); }
    }
    load();
    if (!pollMs) return () => { alive = false; };
    const t = setInterval(load, pollMs);
    return () => { alive = false; clearInterval(t); };
  }, [pollMs]);

  return { data, error, loading };
}

/** usdMinor -> "$12.50" (client-side formatting for small values) */
export function fmtUsd(usdMinor: string): string {
  const n = BigInt(usdMinor);
  const whole = n / 1_000_000n;
  const cents = ((n % 1_000_000n) / 10_000n).toString().padStart(2, '0');
  return `$${whole.toLocaleString('en-US')}.${cents}`;
}

export function fmtGas(mist: string): string {
  const whole = BigInt(mist) / 1_000_000_000n;
  const frac = ((BigInt(mist) % 1_000_000_000n) / 10_000_000n).toString().padStart(2, '0');
  return `${whole}.${frac} SUI`;
}

export { CURRENCY_META };
