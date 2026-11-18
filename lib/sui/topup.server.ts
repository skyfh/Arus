// FROZEN (v2) — SERVER ONLY. Demo add-money: the card / Apple Pay / Halliday / Hata
// checkouts are simulated, but the USD really arrives on Sui testnet from the faucet wallet.
// Hard cap per call so a bug can't drain the faucet.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { USD_TYPE } from './config';
import { signAndRun } from './execute';
import { assertTestnet } from './faucet.server';

export const TOPUP_OPTIONS_MINOR = [10_000_000n, 20_000_000n, 50_000_000n] as const; // $10 / $20 / $50
export const TOPUP_MAX_MINOR = 50_000_000n;

export async function demoTopUpUsd(recipient: string, amountMinor: bigint) {
  if (amountMinor <= 0n || amountMinor > TOPUP_MAX_MINOR) throw new Error('Top-up must be between $0.01 and $50');
  await assertTestnet();
  const s = process.env.SPLASH_FAUCET_SECRET_KEY;
  if (!s) throw new Error('SPLASH_FAUCET_SECRET_KEY is not set');
  const kp = Ed25519Keypair.fromSecretKey(s);
  const tx = new Transaction();
  tx.setSender(kp.toSuiAddress());
  const usd = tx.coin({ type: USD_TYPE, balance: amountMinor });
  tx.moveCall({ target: '0x2::coin::send_funds', typeArguments: [USD_TYPE], arguments: [usd, tx.pure.address(normalizeSuiAddress(recipient))] });
  return signAndRun(kp, tx);
}
