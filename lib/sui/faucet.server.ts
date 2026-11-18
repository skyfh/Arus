// FROZEN — SERVER ONLY. Testnet faucet: gives a new wallet network-fee SUI and test USD.
// SPLASH_FAUCET_SECRET_KEY = "suiprivkey..." of a testnet wallet pre-funded with SUI + Circle testnet USDC.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { suiClient, TESTNET_CHAIN_ID, USD_TYPE } from './config';
import { signAndRun } from './execute';

export const GAS_DRIP_MIST = 100_000_000n; // 0.1 SUI
export const USD_DRIP_MINOR = 20_000_000n; // $20

function faucetKey() {
  const s = process.env.SPLASH_FAUCET_SECRET_KEY;
  if (!s) throw new Error('SPLASH_FAUCET_SECRET_KEY is not set');
  return Ed25519Keypair.fromSecretKey(s);
}

export async function assertTestnet() {
  const id = (await suiClient.core.getChainIdentifier()).chainIdentifier;
  if (id !== TESTNET_CHAIN_ID) throw new Error(`Refusing: not Sui testnet (${id})`);
}

/** Sends 0.1 SUI for fees and (optionally) $20 test USD into the user's address balance. */
export async function dripTestFunds(recipient: string, opts: { usd: boolean }) {
  await assertTestnet();
  const kp = faucetKey();
  const to = normalizeSuiAddress(recipient);
  const tx = new Transaction();
  tx.setSender(kp.toSuiAddress());
  const [gas] = tx.splitCoins(tx.gas, [GAS_DRIP_MIST]);
  tx.transferObjects([gas], to);
  if (opts.usd) {
    const usd = tx.coin({ type: USD_TYPE, balance: USD_DRIP_MINOR });
    tx.moveCall({ target: '0x2::coin::send_funds', typeArguments: [USD_TYPE], arguments: [usd, tx.pure.address(to)] });
  }
  return signAndRun(kp, tx);
}
