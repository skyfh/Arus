// Run: npx tsx --env-file=.env scripts/smoke-v2.ts   Proves the whole money path on Sui testnet. Must print V2 ALL GREEN.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getUsdBalance } from '../lib/sui/balance';
import { buildCreateAllowance, buildDrawAllowance, buildRevokeAllowance, buildSendUsd, buildConsolidate } from '../lib/sui/builders';
import { allowanceIdsFrom, signAndRun } from '../lib/sui/execute';
import { dripTestFunds } from '../lib/sui/faucet.server';
import { demoTopUpUsd } from '../lib/sui/topup.server';
import { verifyUsdPayment } from '../lib/sui/verify.server';
import { storeReceiptOnWalrus } from '../lib/sui/walrus.server';
import { usdRates } from '../lib/fx.server';
import { quoteCashOut, formatMyr } from '../lib/cashout';

const DEPOSIT = process.env.NEXT_PUBLIC_DEMO_EXCHANGE_DEPOSIT_ADDRESS;
if (!DEPOSIT) throw new Error('Set NEXT_PUBLIC_DEMO_EXCHANGE_DEPOSIT_ADDRESS');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const a = new Ed25519Keypair(), b = new Ed25519Keypair();
const A = a.toSuiAddress(), B = b.toSuiAddress();
const ok = (m: string, d?: string) => console.log('✔', m, d ?? '');

await dripTestFunds(A, { usd: true }); ok('drip A ($20 + 0.1 SUI)');
await dripTestFunds(B, { usd: false }); ok('drip B (0.1 SUI)');
await demoTopUpUsd(A, 10_000_000n); ok('demo top-up A +$10');
await sleep(2000);
const bal = await getUsdBalance(A); console.log('A balance', bal);
if (bal.coinBalance > 0n) { await signAndRun(a, buildConsolidate({ owner: A, coinBalanceMinor: bal.coinBalance })); ok('consolidate A'); }

const pay = await signAndRun(a, buildSendUsd({ sender: A, recipient: B, amountMinor: 5_000_000n }));
const v = await verifyUsdPayment({ digest: pay.digest, sender: A, recipient: B, amountMinor: 5_000_000n });
if (!v.ok) throw new Error('verify failed: ' + v.reason); ok('A pays B $5 (verified)', pay.digest);
const w = await storeReceiptOnWalrus({ digest: pay.digest, from: A, to: B, amountMinor: '5000000' });
console.log(w.blobId ? '✔ walrus receipt' : '✗ walrus (non-blocking)', w.blobId ?? w);

const created = await signAndRun(a, buildCreateAllowance({ funder: A, spender: B, name: 'smoke', monthlyLimitMinor: 3_000_000n, expiresAtMs: Date.now() + 30 * 864e5 }));
const { allowanceId, capId } = allowanceIdsFrom(created); ok('allowance $3/month', allowanceId);
await signAndRun(b, buildDrawAllowance({ spender: B, funder: A, allowanceId, amountMinor: 2_000_000n })); ok('B draws $2');
try {
  await signAndRun(b, buildDrawAllowance({ spender: B, funder: A, allowanceId, amountMinor: 2_000_000n }));
  throw new Error('over-limit draw SUCCEEDED — must fail');
} catch (e) { if (String(e).includes('SUCCEEDED')) throw e; ok('over-limit draw refused'); }
await signAndRun(a, buildRevokeAllowance({ funder: A, allowanceId, capId })); ok('allowance cancelled');

const co = await signAndRun(a, buildSendUsd({ sender: A, recipient: DEPOSIT, amountMinor: 5_000_000n }));
const vc = await verifyUsdPayment({ digest: co.digest, sender: A, recipient: DEPOSIT, amountMinor: 5_000_000n });
if (!vc.ok) throw new Error('cash-out verify failed'); ok('cash-out leg $5 to demo exchange address', co.digest);

const fx = await usdRates();
console.log(fx.MYR ? `✔ USD/MYR ${fx.MYR} → $50 = ${formatMyr(quoteCashOut(50_000_000n, fx.MYR).myrSen)}` : '✗ MYR rate unavailable — set DEMO_FX_JSON before demo');
console.log('V2 ALL GREEN');
