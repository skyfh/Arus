'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadOrCreateWallet } from '@/lib/sui/local-wallet';
import { buildSendUsd } from '@/lib/sui/builders';
import { signAndRun } from '@/lib/sui/execute';
import { formatUsd } from '@/lib/sui/money';
import { MarkdownLite } from '@/components/markdown-lite';

type Msg = { role: 'user' | 'assistant'; content: string };
type Draft = {
  id: string; kind: string;
  payload: Record<string, string | null>;
  sources: Record<string, string>;
  needsStepUp: boolean; warnings: string[];
  amountFormatted: string | null; expiresAt: string;
};

/** Zeke: docked chat panel. Drafts, confirm cards, step-up. The model's text never appears on the card. */
export default function ZekePage() {
  return (
    <Suspense fallback={<div className="p-6"><p className="text-sm" role="status">Loading…</p></div>}>
      <ZekeInner />
    </Suspense>
  );
}

function ZekeInner() {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpToken, setStepUpToken] = useState<string | null>(null);
  const [pwd, setPwd] = useState('');
  const [paidReceipt, setPaidReceipt] = useState<string | null>(null);

  // Pre-fill from ?q= (suggestion chips)
  useEffect(() => {
    const q = params.get('q');
    if (q && messages.length === 0) { void send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: text }]);
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/zeke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: text }].slice(-8) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Zeke is unavailable — use the normal screens.'); setBusy(false); return; }
      setMessages(m => [...m, { role: 'assistant', content: j.reply ?? '' }]);
      if (j.draftId) await loadDraft(j.draftId);
    } catch {
      setError('Zeke is unavailable — use the normal screens.');
    }
    setBusy(false);
  }

  async function loadDraft(id: string) {
    const r = await fetch(`/api/zeke/drafts/${id}`);
    const j = await r.json();
    if (r.ok) setDraft(j); else setError(j.error ?? 'Could not load the draft.');
  }

  async function stepUp(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/auth/step-up', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd, purpose: draft!.id }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error ?? 'That password is not right.'); return; }
    setStepUpToken(j.stepUpToken); setStepUpOpen(false); setPwd('');
  }

  async function confirmDraft() {
    setBusy(true); setError('');
    try {
      const d = draft!;
      const me = await fetch('/api/me').then(r => r.json());
      const kp = loadOrCreateWallet(me.id);
      const p = d.payload;

      if (d.kind === 'SEND') {
        const tx = buildSendUsd({ sender: kp.toSuiAddress(), recipient: p.recipientAddress!, amountMinor: BigInt(p.amountMinor!) });
        const run = await signAndRun(kp, tx);
        const c = await fetch('/api/payments/confirm', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            digest: run.digest, kind: 'SEND', toAddress: p.recipientAddress,
            amountMinor: p.amountMinor, note: p.note ?? undefined, draftId: d.id,
            stepUpToken: stepUpToken ?? undefined,
          }),
        });
        const j = await c.json();
        if (!c.ok) throw new Error(j.error ?? 'Could not record the payment.');
        setPaidReceipt(j.receiptId);
      } else if (d.kind === 'PAY_REQUEST') {
        const tx = buildSendUsd({ sender: kp.toSuiAddress(), recipient: p.payeeAddress!, amountMinor: BigInt(p.amountMinor!) });
        const run = await signAndRun(kp, tx);
        const c = await fetch('/api/payments/confirm', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            digest: run.digest, kind: 'REQUEST_PAYMENT', toAddress: p.payeeAddress,
            amountMinor: p.amountMinor, requestSlug: p.slug, draftId: d.id,
            stepUpToken: stepUpToken ?? undefined,
          }),
        });
        const j = await c.json();
        if (!c.ok) throw new Error(j.error ?? 'Could not record the payment.');
        setPaidReceipt(j.receiptId);
      } else if (d.kind === 'CREATE_REQUEST') {
        // The request row already exists (created at draft time); just show Share
        setPaidReceipt('request');
        setDraft(null);
      } else if (d.kind === 'CASH_OUT') {
        // Go to the cash-out flow prefilled: user signs there
        const q = new URLSearchParams({
          dest: p.destination!, amount: p.requestedAmount ?? '',
          accountId: p.accountId ?? '', billerCode: p.billerCode ?? '', billRef: p.billRef ?? '',
          bankName: p.bankName ?? '',
        });
        window.location.href = `/dashboard/cashout?${q}`;
        return;
      }
      setDraft(null); setStepUpToken(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payment could not be completed.');
    }
    setBusy(false);
  }

  async function cancelDraft() {
    if (!draft) return;
    await fetch(`/api/zeke/drafts/${draft.id}/cancel`, { method: 'POST' });
    setDraft(null);
  }

  const expIn = draft ? Math.max(0, Math.floor((new Date(draft.expiresAt).getTime() - Date.now()) / 1000)) : 0;

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b border-[color:var(--glass-border)] bg-[color:var(--surface)] backdrop-blur-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Zeke</h1>
            <p className="text-xs text-[color:var(--ink-muted)]">BM · English · 中文 · Zeke drafts — you approve every payment</p>
          </div>
          <a href="/dashboard" className="btn-secondary px-3 py-1 text-xs">Close</a>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {messages.length === 0 && (
            <>
              <p className="text-sm text-[color:var(--ink-muted)]">Hi! Ask me anything about your money.</p>
              <div className="flex flex-wrap gap-2">
                {[['Check my balance in RM', 'q=check-balance'], ['Invoice someone', ''], ['Send to a handle', ''], ['Pay a bill from a photo', '']].map(([label], i) => (
                  <button key={i} className="btn-secondary text-xs" onClick={() => send(label)}>{label}</button>
                ))}
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'self-end bg-[color:var(--ink)] text-white' : 'self-start bg-[color:var(--surface)] border border-[color:var(--line)]'}`}>
              {m.role === 'assistant' ? <MarkdownLite text={m.content} /> : m.content}
            </div>
          ))}
          {busy && <p className="text-xs text-[color:var(--ink-muted)] self-start" role="status">Zeke is thinking…</p>}
          {error && <p className="text-sm text-[color:var(--error)]" role="alert">{error}</p>}

          {/* ConfirmCard: server payload only */}
          {draft && !paidReceipt && (
            <div className="card p-6 self-start w-full max-w-md flex flex-col gap-3" aria-label="Review · drafted by Zeke">
              <p className="text-xs font-semibold text-[color:var(--gold-ink)]">Review · drafted by Zeke</p>

              {draft.kind === 'SEND' && (
                <>
                  <p className="text-2xl font-bold tnum">{draft.amountFormatted}</p>
                  <p className="text-lg font-bold">{draft.payload.recipientName}</p>
                  <p className="text-xs text-[color:var(--ink-muted)]">{draft.payload.source}</p>
                  {draft.payload.myrShown && <p className="text-xs tnum text-[color:var(--ink-muted)]">≈ RM {draft.payload.myrShown}</p>}
                  {draft.payload.note && <p className="text-sm text-[color:var(--ink-muted)]">Note: {draft.payload.note}</p>}
                </>
              )}
              {draft.kind === 'PAY_REQUEST' && (
                <>
                  <p className="text-2xl font-bold tnum">{draft.amountFormatted}</p>
                  <p className="text-lg font-bold">Pay {draft.payload.payeeName}</p>
                  <p className="text-xs tnum text-[color:var(--ink-muted)]">{draft.payload.number}</p>
                </>
              )}
              {draft.kind === 'CREATE_REQUEST' && (
                <>
                  <p className="text-2xl font-bold tnum">{draft.amountFormatted}</p>
                  <p className="text-lg font-bold">Request · {draft.payload.number}</p>
                  <p className="text-sm text-[color:var(--ink-muted)]">{draft.payload.description}</p>
                </>
              )}
              {draft.kind === 'CASH_OUT' && (
                <>
                  <p className="text-2xl font-bold tnum">{draft.amountFormatted}</p>
                  <p className="text-lg font-bold">Cash out · {draft.payload.destination}</p>
                  {draft.payload.billerCode && <p className="text-xs tnum">Biller {draft.payload.billerCode} · Ref {draft.payload.billRef}</p>}
                  {draft.payload.accountId && <p className="text-xs tnum">To {draft.payload.accountId}</p>}
                  {draft.warnings?.includes('read_from_image') && (
                    <p className="text-xs rounded-xl p-2" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>Read from image — check it</p>
                  )}
                </>
              )}

              <p className="text-xs tnum text-[color:var(--pending)]">Expires in {expIn}s</p>
              {draft.warnings?.length > 0 && (
                <ul className="text-xs list-disc pl-4" style={{ color: 'var(--warn)' }}>
                  {draft.warnings.map((w) => <li key={w}>{w.replaceAll('_', ' ')}</li>)}
                </ul>
              )}
              <p className="text-xs text-[color:var(--ink-muted)]">Network fee: free on testnet.</p>

              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => (draft.needsStepUp && !stepUpToken ? setStepUpOpen(true) : confirmDraft())} disabled={busy}>
                  Confirm
                </button>
                <button className="btn-secondary flex-1" onClick={cancelDraft} disabled={busy}>Cancel</button>
              </div>
            </div>
          )}

          {draft?.kind === 'CREATE_REQUEST' && paidReceipt === 'request' && (
            <div className="card p-6 self-start w-full max-w-md" aria-label="Share your request">
              <p className="text-sm font-medium">Request created. Share the link:</p>
              <p className="text-xs tnum break-all mt-2">{window.location.origin}/pay/{draft.payload.slug}</p>
              <button className="btn-primary mt-3" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/${draft.payload.slug}`)}>Copy link</button>
            </div>
          )}

          {paidReceipt && paidReceipt !== 'request' && (
            <a className="btn-primary self-start" href={`/receipt/${paidReceipt}`}>View receipt</a>
          )}
        </div>
      </div>

      {stepUpOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirm it's you">
          <form onSubmit={stepUp} className="card w-full max-w-sm p-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Confirm it&apos;s you</h2>
            <p className="text-sm text-[color:var(--ink-muted)]">Enter your password to approve this draft.</p>
            <input type="password" className="field" value={pwd} onChange={e => setPwd(e.target.value)} required autoComplete="current-password" aria-label="Password" />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Confirm</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setStepUpOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <footer className="p-4 border-t border-[color:var(--glass-border)] bg-[color:var(--surface)] backdrop-blur-xl">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="max-w-3xl mx-auto flex gap-2">
          <input
            className="field flex-1" placeholder="Type what you want…"
            value={input} onChange={e => setInput(e.target.value)} aria-label="Message Zeke"
          />
          <button type="submit" className="btn-primary" disabled={busy} aria-label="Send">➤</button>
        </form>
        <p className="text-center text-xs text-[color:var(--ink-muted)] mt-2">Zeke drafts — you approve every payment</p>
      </footer>
    </div>
  );
}
