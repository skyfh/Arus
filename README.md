# Arus

**Arus** ("current" in Bahasa Malaysia) is the consumer wallet of Splash Finance — a non-custodial USD wallet on the web for cross-border money in Southeast Asia, with **Zeke**, an AI assistant that drafts payments for your approval.

> Get paid from anywhere. Cash out to Ryt Bank, Touch 'n Go or any DuitNow bank. Proof for every payment, and an assistant that speaks your language.

## What it is

- **Non-custodial USD wallet** on **Sui testnet**. Your Ed25519 key is generated in the browser (`lib/sui/local-wallet.ts`) and never leaves it — the server stores only your public address.
- **One balance: USD.** MYR/IDR/THB/SGD/PHP rows show what your USD is worth at today's rate; there are no per-currency balances.
- **name@arus handles.** Send to `@aina`, `aina` or `aina@arus`; share `/u/aina`.
- **Payment requests (invoices)** with public `/pay/[slug]` links and inline sign-up for the payer.
- **Receipts with proof**: every payment is verified on chain (`verifyUsdPayment`), hashed (SHA-256 over canonical JSON), and stored on Walrus. `/receipt/[id]` re-verifies the hash in your browser with `crypto.subtle`.
- **Native Sui allowances**: family allowances enforced by the network (`0x2::allowance`), not by Arus.
- **Cash out** (demo) to Ryt Bank, Touch 'n Go eWallet, other DuitNow banks or JomPAY bills — the USD leg to the demo exchange deposit address is real; the ringgit payout is simulated and labelled.
- **Zeke** (ILMU API): chat in English/BM/中文, screenshot reading, drafts for sends/invoices/cash-outs — every draft lands on a server-rendered **ConfirmCard**; the model's text never appears on the card.

## What's simulated (labelled "Demo")

Card / Apple Pay / Halliday top-ups (real testnet USD arrives from the faucet wallet), Hata transfer-in, the ringgit payout and JomPAY payout legs, and KYC review. Everything else is real on Sui testnet.

## Run it

```bash
npm install
cp .env.example .env      # fill in the values below
npx prisma migrate deploy
npm run dev               # http://localhost:3000
```

Required env (see `.env.example`):

- `DATABASE_URL` — PostgreSQL (Prisma 6)
- `SESSION_SECRET` — 32+ random chars
- `SPLASH_FAUCET_SECRET_KEY` — `suiprivkey…` of a testnet wallet funded with SUI + Circle testnet USDC (server only)
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUI_RPC_URL`, `NEXT_PUBLIC_SUI_GRAPHQL_URL`, `NEXT_PUBLIC_USD_COIN_TYPE`
- `NEXT_PUBLIC_DEMO_EXCHANGE_DEPOSIT_ADDRESS` — where cash-out legs go
- `WALRUS_PUBLISHER_URL`, `NEXT_PUBLIC_WALRUS_AGGREGATOR_URL`
- `ILMU_API_KEY`, `ILMU_BASE_URL`, `ILMU_MODEL`, `ILMU_VISION_MODEL` — Zeke (server only)
- `DEMO_FX_JSON` — optional offline rates, e.g. `{"MYR":4.41}`

Checks:

```bash
npx tsc --noEmit      # 0 errors
npm run smoke         # full money path on testnet → prints V2 ALL GREEN
npm run smoke:zeke    # ILMU connectivity, guard, tool calling → ZEKE SMOKE GREEN
npm run eval:zeke     # 30-case eval → prints a table, exits non-zero on failure
```

## How proof works

1. The browser signs a transfer with the frozen builders (`lib/sui/builders.ts`) and executes via `signAndRun`.
2. The client reports the digest to `POST /api/payments/confirm`. **The server never trusts the browser**: `verifyUsdPayment` re-reads the transaction on chain and confirms sender, recipient and amount.
3. State checks run (request open, amount matches, daily limits, draft pending, step-up token if required).
4. Payment + Receipt are saved in one transaction, idempotent on digest.
5. The receipt body is canonical JSON; its SHA-256 is stored with it. After responding, the receipt is stored on Walrus (non-blocking) and the blob id is linked.
6. Anyone with the receipt link can press **Verify** and recompute the hash locally.

## How Zeke stays safe

- **Five tools only**: `get_balance`, `get_activity`, `get_allowances`, `lookup_request`, `create_draft`. Asserted by the eval.
- **Guard first**: a classifier refuses prompt extraction, limit-change requests and urgency/scam pressure.
- **Vision is quarantined**: image fields are read by a separate model call with no tools, returned as zod-validated `ImageFields`, and every field is shown as "read from image — check it".
- **Deterministic validation**: the model's proposal is only a suggestion. The server resolves recipients (handle/contact/email; a raw address is accepted **only if the user typed it** in the conversation), converts amounts with live rates, and enforces caps: ≤ $100 per Zeke payment, ≤ $300/day, $1,000/day overall (Basic tier).
- **Step-up**: amounts above $50, first-time recipients, or any warning requires a password re-entry bound to the draft id (5 minutes).
- **The ConfirmCard is server data only** — the model's text never appears on it. Drafts expire in 10 minutes; a duplicate (same recipient+amount within 10 minutes) is flagged.
- **Zeke never** sees your key, signs, creates contacts or allowances, follows instructions in untrusted text, gives investment advice, or claims a licence. If ILMU is down, every manual flow still works.

## Honest-demo wording

A testnet banner is always visible; the footer says: *"Arus is not a licensed money-services business. Partner and payout flows are shown for demonstration."* Ryt Bank / Touch 'n Go / JomPAY appear as destination names only. "Hata" appears only as "From Hata (demo)".

## Stack

Next.js 15.5.29 · React 19 · TypeScript · Tailwind 4 · `@mysten/sui` 2.31.3 (gRPC + GraphQL) · Prisma 6.19.3 / PostgreSQL · jose · Walrus testnet · ILMU API.

## Deploy

Railway: connect the GitHub repo, add PostgreSQL, set the env vars, `npm run build` / `npm start` (runs `prisma migrate deploy` first). Live demo: `https://arusapp-production.up.railway.app`.
