'use client';

import { use, useEffect, useState } from 'react';
import { explorerTxUrl } from '@/lib/sui/config';

type ReceiptData = {
  id: string;
  body: Record<string, unknown>;
  sha256: string;
  walrusBlobId: string | null;
  walrusUrl: string | null;
  txDigest: string;
  createdAt: string;
};

/** Public receipt: transaction ID, SHA-256, Walrus blob, in-browser Verify (crypto.subtle). */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  const [verify, setVerify] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    fetch(`/api/public/receipts/${id}`).then(r => r.json()).then(j => {
      if (j.error) setError(j.error); else setData(j);
    }).catch(() => setError('Could not load the receipt.'));
  }, [id]);

  async function runVerify() {
    if (!data) return;
    setVerify('checking');
    try {
      // Recompute canonical JSON in the browser (sorted keys, same as server) and hash with crypto.subtle
      const canon = (v: unknown): string => {
        if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
        if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`;
        return JSON.stringify(v);
      };
      const bytes = new TextEncoder().encode(canon(data.body));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      setVerify(hex === data.sha256 ? 'ok' : 'fail');
    } catch {
      setVerify('fail');
    }
  }

  if (error) {
    return (
      <main className="max-w-xl mx-auto p-6">
        <div className="card p-6" role="alert"><p className="text-sm text-[color:var(--error)]">{error}</p></div>
      </main>
    );
  }
  if (!data) return <main className="max-w-xl mx-auto p-6"><p className="text-sm" role="status">Loading receipt…</p></main>;

  const b = data.body as Record<string, string | null>;
  const amountMinor = BigInt(b.amountMinor ?? '0');
  const usd = `$${(amountMinor / 1_000_000n).toLocaleString('en-US')}.${((amountMinor % 1_000_000n) / 10_000n).toString().padStart(2, '0')}`;

  return (
    <main className="max-w-xl mx-auto p-6">
      <div className="card p-8 flex flex-col gap-4" aria-labelledby="receipt-h">
        <p className="text-xs text-[color:var(--pending)]">Proof of payment · Sui testnet</p>
        <h1 id="receipt-h" className="text-3xl font-bold tnum">{usd}</h1>
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 tnum">
          <dt className="text-[color:var(--ink-muted)]">From</dt><dd className="break-all">{b.from}</dd>
          <dt className="text-[color:var(--ink-muted)]">To</dt><dd className="break-all">{b.to}</dd>
          <dt className="text-[color:var(--ink-muted)]">Date</dt><dd>{new Date(data.createdAt).toLocaleString()}</dd>
          {b.requestId && <><dt className="text-[color:var(--ink-muted)]">Request</dt><dd>{b.requestId}</dd></>}
          <dt className="text-[color:var(--ink-muted)]">Transaction ID</dt>
          <dd><a className="underline break-all" href={explorerTxUrl(data.txDigest)} target="_blank" rel="noreferrer">{data.txDigest}</a></dd>
          <dt className="text-[color:var(--ink-muted)]">SHA-256</dt><dd className="break-all">{data.sha256}</dd>
          {data.walrusBlobId && <><dt className="text-[color:var(--ink-muted)]">Walrus blob</dt>
            <dd><a className="underline break-all" href={data.walrusUrl ?? '#'} target="_blank" rel="noreferrer">{data.walrusBlobId}</a></dd></>}
          {b.draftedBy === 'zeke' && <><dt className="text-[color:var(--ink-muted)]">Drafted by</dt><dd>Drafted by Zeke, confirmed by you</dd></>}
        </dl>

        <div className="flex items-center gap-3 mt-2">
          <button className="btn-primary" onClick={runVerify} disabled={verify === 'checking'}>
            {verify === 'checking' ? 'Verifying…' : 'Verify'}
          </button>
          {verify === 'ok' && <p className="text-sm font-semibold text-[color:var(--ok)]" role="status">✓ Hash matches — proof is intact.</p>}
          {verify === 'fail' && <p className="text-sm font-semibold text-[color:var(--error)]" role="alert">✗ Hash does not match.</p>}
        </div>
        <p className="text-xs text-[color:var(--ink-muted)]">
          Verify recomputes the SHA-256 of this receipt in your browser and compares it to the stored hash.
        </p>
      </div>
    </main>
  );
}
