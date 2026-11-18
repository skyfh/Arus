import Link from 'next/link';

export const metadata = { title: 'Arus — Get paid from anywhere' };

/** Landing: positioning, how it works, features, Zeke showcase, proof, trust, FAQ. */
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-[color:var(--ink)] leading-tight">
          Get paid from anywhere.
        </h1>
        <p className="text-lg text-[color:var(--ink-muted)] mt-4 max-w-2xl mx-auto">
          Cash out to Ryt Bank, Touch &apos;n Go or any DuitNow bank. Proof for every payment,
          and an assistant that speaks your language.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <Link href="/signup" className="btn-primary">Create your account</Link>
          <Link href="/login" className="btn-secondary">Log in</Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-10" aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl font-bold text-center">How it works</h2>
        <ol className="grid sm:grid-cols-4 gap-4 mt-8">
          {[
            ['1', 'Get paid', 'Share your name@arus link or QR. Money arrives with a receipt you can verify.'],
            ['2', 'Proof', 'Every payment gets a receipt with a SHA-256 hash, stored on Walrus.'],
            ['3', 'Cash out', 'To Ryt Bank, Touch ’n Go or any DuitNow bank.'],
            ['4', 'Zeke', 'An assistant that drafts everything — you approve every payment.'],
          ].map(([n, title, body]) => (
            <li key={n} className="card p-5">
              <p className="text-3xl font-bold text-[color:var(--gold)] tnum">{n}</p>
              <p className="font-semibold mt-2">{title}</p>
              <p className="text-sm text-[color:var(--ink-muted)] mt-1">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Feature row */}
      <section className="max-w-4xl mx-auto px-6 py-6" aria-label="Features">
        <div className="flex flex-wrap gap-3 justify-center">
          {['Get paid with proof', 'Cash out to Ryt Bank, Touch ’n Go or any DuitNow bank', 'Zeke, your money assistant (BM, English, 中文)', 'Family allowance'].map(f => (
            <span key={f} className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm">{f}</span>
          ))}
        </div>
      </section>

      {/* Zeke showcase */}
      <section className="max-w-4xl mx-auto px-6 py-10" aria-labelledby="zeke-h">
        <h2 id="zeke-h" className="text-2xl font-bold text-center">Meet Zeke</h2>
        <p className="text-center text-[color:var(--ink-muted)] mt-2">Zeke drafts — you approve every payment.</p>
        <div className="card p-6 mt-8 max-w-xl mx-auto flex flex-col gap-3">
          <div className="self-end rounded-2xl px-4 py-2 text-sm text-white" style={{ background: 'var(--ink)' }}>
            hantar RM30 kat @mak untuk barang dapur
          </div>
          <div className="self-start rounded-2xl px-4 py-2 text-sm border border-[color:var(--line)]">
            Here it is — check and confirm.
          </div>
          <div className="border border-[color:var(--gold)] rounded-2xl p-4 bg-[color:var(--surface-2)]" aria-label="Example confirm card">
            <p className="text-xs font-semibold text-[color:var(--gold-ink)]">Review · drafted by Zeke</p>
            <p className="text-2xl font-bold tnum mt-1">$6.80</p>
            <p className="font-bold">Mak</p>
            <p className="text-xs text-[color:var(--ink-muted)]">Arus user @mak · ≈ RM 30.00</p>
            <div className="flex gap-2 mt-3">
              <span className="btn-primary text-sm px-4 py-1.5">Confirm</span>
              <span className="btn-secondary text-sm px-4 py-1.5">Cancel</span>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="max-w-4xl mx-auto px-6 py-10" aria-labelledby="proof-h">
        <h2 id="proof-h" className="text-2xl font-bold text-center">Proof you can show anyone</h2>
        <div className="card p-6 mt-8 max-w-xl mx-auto" aria-label="Example receipt">
          <p className="text-xs text-[color:var(--pending)]">Proof of payment · Sui testnet</p>
          <p className="text-3xl font-bold tnum mt-1">$50.00</p>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tnum mt-3">
            <dt className="text-[color:var(--ink-muted)]">Transaction ID</dt>
            <dd className="break-all">H4KrX…9fQp <span className="text-[color:var(--teal)] underline">suiscan</span></dd>
            <dt className="text-[color:var(--ink-muted)]">SHA-256</dt>
            <dd className="break-all">9f2c…ab01</dd>
            <dt className="text-[color:var(--ink-muted)]">Walrus blob</dt>
            <dd className="break-all">uJ8V…x2Km</dd>
          </dl>
          <p className="text-sm mt-3"><span className="font-semibold text-[color:var(--ok)]">✓ Verify</span> recomputes the hash in your browser.</p>
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-4xl mx-auto px-6 py-10" aria-labelledby="trust-h">
        <h2 id="trust-h" className="text-2xl font-bold text-center">Trust</h2>
        <ul className="grid sm:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto text-sm">
          <li className="card p-5">🔑 <strong>Non-custodial.</strong> Your key stays in your browser. We can never move your money.</li>
          <li className="card p-5">🧪 <strong>Testnet.</strong> Demo on Sui testnet — no real money.</li>
          <li className="card p-5">📜 <strong>Honest demo.</strong> Arus is not a licensed money-services business. Partner and payout flows are shown for demonstration.</li>
          <li className="card p-5">👀 <strong>Zeke drafts.</strong> You approve every payment. Zeke never signs anything.</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-10" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-2xl font-bold text-center">FAQ</h2>
        {[
          ['Is this real money?', 'No. Everything runs on Sui testnet with test USDC. No real money moves.'],
          ['Where is my wallet key kept?', 'In your browser only. The server sees your public address, never your key.'],
          ['What can Zeke do?', 'Zeke checks your balance, drafts sends, invoices and cash-outs in English, Bahasa Melayu or Chinese. It never moves money without your confirmation.'],
          ['What are the fees?', 'The demo shows a 0.30% cash-out fee. Network fees on testnet are free.'],
          ['Is Arus licensed?', 'Arus is not a licensed money-services business. Partner and payout flows are shown for demonstration.'],
          ['What currencies can I hold?', 'Only USD. Other currencies show what your USD is worth at today\'s rate.'],
        ].map(([q, a]) => (
          <details key={q} className="card p-5 mt-3">
            <summary className="font-semibold cursor-pointer">{q}</summary>
            <p className="text-sm text-[color:var(--ink-muted)] mt-2">{a}</p>
          </details>
        ))}
      </section>

      <footer className="border-t border-[color:var(--line)] py-8 text-center text-sm text-[color:var(--ink-muted)]">
        <p>Arus by Splash Finance</p>
        <p className="mt-1">Arus is not a licensed money-services business. Partner and payout flows are shown for demonstration.</p>
        <p className="mt-1">Demo on Sui testnet — no real money.</p>
      </footer>
    </div>
  );
}
