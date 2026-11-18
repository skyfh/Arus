# AGENTS.md — Arus build routing

Arus: non-custodial USD wallet on Sui testnet with the Zeke assistant (ILMU API).
Build prompt: Arus build prompt v2 (Smart Nation 2026 Buildathon × Kraced).

## Routing table — read the SKILL.md before each task

| Task | Read first (under `.agents/skills/`) |
|---|---|
| Anything touching Sui, balances or transactions | `sui-ts-sdk-backend`, `ptbs`, `sui-networks-gas`, `accessing-data` |
| Any page, component or styling | `frontend-design`, `design-taste-frontend`, `ui-ux-pro-max`, `web-design-guidelines` |
| React/Next components and data fetching | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Prisma schema, migrations, queries | `prisma-orm-setup`, `prisma-client-api`, `prisma-cli` |
| Phase checks in a browser | `webapp-testing` (Playwright) |
| Deploy | `use-railway` |

## Conflict rules (override any skill)

1. Every frozen file in §10 (`lib/sui/*`, `lib/zeke/schema.ts`, `lib/zeke/provenance.ts`, `lib/zeke/ilmu.server.ts`, `lib/zeke/caps.ts`, `lib/fx.ts`, `lib/fx.server.ts`, `lib/cashout.ts`) wins over every skill. Ignore skill patterns that conflict (`SuiClient`, `getCoins`/`mergeCoins`, dapp-kit, zkLogin).
2. Never install or use `frontend-apps` (dapp-kit), `zklogin`, `sui-move`, `walrus-sites` or DeepBook skills.
3. Prisma stays on version 6. No `prisma.config.ts`, no driver adapters.
4. Brand wins over taste skills: use the warm-paper palette (§4) — `--bg:#F6F0ED`, teal ink `#1F4452`, gold accent `#D9A441`.

## Hard rules reminders

- Money is `bigint` minor units (USD 6 decimals). Never `parseFloat` money.
- The private key never leaves the browser; only `*.server.ts` files use the faucet key.
- Server verifies every reported digest with `verifyUsdPayment` before marking paid.
- Zeke proposes only; five tools; every draft confirmed by the user on a server-rendered card.
- Every user-facing error is one plain sentence. Testnet banner always visible.
