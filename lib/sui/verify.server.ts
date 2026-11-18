// FROZEN — SERVER ONLY. Never trust a digest the browser reports: confirm on chain that
// `recipient` received at least `amountMinor` USD in this transaction, sent by `sender`.
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { suiClient, USD_TYPE } from './config';

export async function verifyUsdPayment(p: { digest: string; sender: string; recipient: string; amountMinor: bigint }) {
  const res = await suiClient.getTransaction({
    digest: p.digest,
    include: { balanceChanges: true, effects: true, transaction: true },
  });
  const t = res.$kind === 'Transaction' ? res.Transaction : res.FailedTransaction;
  if (!t.status.success) return { ok: false as const, reason: 'Transaction failed on chain' };
  const sender = normalizeSuiAddress(t.transaction?.sender ?? '');
  if (sender !== normalizeSuiAddress(p.sender)) return { ok: false as const, reason: 'Sent by a different account' };
  const usd = normalizeStructTag(USD_TYPE);
  const got = (t.balanceChanges ?? [])
    .filter((c) => normalizeStructTag(c.coinType) === usd && normalizeSuiAddress(c.address) === normalizeSuiAddress(p.recipient))
    .reduce((s, c) => s + BigInt(c.amount), 0n);
  if (got < p.amountMinor) return { ok: false as const, reason: 'Recipient did not receive the full amount' };
  return { ok: true as const, receivedMinor: got, sender };
}
