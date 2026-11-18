// FROZEN. Signs with an in-browser Ed25519 key (client) or the faucet key (server) and executes.
import type { Keypair } from '@mysten/sui/cryptography';
import type { Transaction } from '@mysten/sui/transactions';
import { suiClient } from './config';

export type TxResult = {
  digest: string;
  created: { id: string; type: string }[];
};

export class TxFailed extends Error {
  constructor(message: string, public digest?: string) {
    super(message);
  }
}

/** Turns Move abort codes into words a person understands. */
export function humanizeTxError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('insufficient') || s.includes('balance')) return 'Not enough USD in this account.';
  if (s.includes('allowance') && (s.includes('rate') || s.includes('exceed') || s.includes('limit')))
    return 'This is above what the allowance lets you take right now.';
  if (s.includes('expired')) return 'This allowance has expired.';
  if (s.includes('gas')) return 'Network fee top-up needed. Tap "Get test funds" first.';
  return 'The network refused this payment. Nothing was sent.';
}

export async function signAndRun(signer: Keypair, tx: Transaction): Promise<TxResult> {
  let res;
  try {
    res = await suiClient.signAndExecuteTransaction({
      signer,
      transaction: tx,
      include: { effects: true, objectTypes: true, balanceChanges: true },
    });
  } catch (e) {
    throw new TxFailed(humanizeTxError(String((e as Error).message ?? e)));
  }
  const t = res.$kind === 'Transaction' ? res.Transaction : res.FailedTransaction;
  if (!t.status.success) {
    throw new TxFailed(humanizeTxError(String(t.status.error?.message ?? '')), t.digest);
  }
  await suiClient.waitForTransaction({ digest: t.digest });
  const types = (t.objectTypes ?? {}) as Record<string, string>;
  const created = (t.effects?.changedObjects ?? [])
    .filter((o) => o.idOperation === 'Created')
    .map((o) => ({ id: o.objectId, type: types[o.objectId] ?? '' }));
  return { digest: t.digest, created };
}

/** After buildCreateAllowance: pick out the two new object ids. */
export function allowanceIdsFrom(r: TxResult) {
  const allowance = r.created.find((o) => o.type.includes('::allowance::Allowance<'))?.id;
  const cap = r.created.find((o) => o.type.includes('::allowance::AllowanceCap<'))?.id;
  if (!allowance || !cap) throw new TxFailed('Allowance was not created', r.digest);
  return { allowanceId: allowance, capId: cap };
}
