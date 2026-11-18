// FROZEN — every call here was proven on Sui testnet (latest-splash experiments/v2-phase0).
// Rule: all USD that moves inside Splash lands in the receiver's ADDRESS BALANCE
// (coin::send_funds / balance::send_funds), because native allowances only draw
// from the funder's address balance.
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { USD_TYPE } from './config';

const BAL = `0x2::balance::Balance<${USD_TYPE}>`;

function assertPositive(v: bigint, what: string) {
  if (v <= 0n) throw new Error(`${what} must be above zero`);
}

/** Pay someone: amount comes from the sender's coins and/or address balance. */
export function buildSendUsd(p: { sender: string; recipient: string; amountMinor: bigint }) {
  assertPositive(p.amountMinor, 'Amount');
  const tx = new Transaction();
  tx.setSender(normalizeSuiAddress(p.sender));
  const coin = tx.coin({ type: USD_TYPE, balance: p.amountMinor });
  tx.moveCall({
    target: '0x2::coin::send_funds',
    typeArguments: [USD_TYPE],
    arguments: [coin, tx.pure.address(normalizeSuiAddress(p.recipient))],
  });
  return tx;
}

/** Move coin-object USD (e.g. from Circle's faucet) into the owner's own address balance. */
export function buildConsolidate(p: { owner: string; coinBalanceMinor: bigint }) {
  assertPositive(p.coinBalanceMinor, 'Coin balance');
  const owner = normalizeSuiAddress(p.owner);
  const tx = new Transaction();
  tx.setSender(owner);
  const coin = tx.coin({ type: USD_TYPE, balance: p.coinBalanceMinor });
  tx.moveCall({ target: '0x2::coin::send_funds', typeArguments: [USD_TYPE], arguments: [coin, tx.pure.address(owner)] });
  return tx;
}

/**
 * Create a native Sui allowance: `spender` may draw up to `monthlyLimitMinor` per calendar
 * month from the funder's address balance, until `expiresAtMs`. Optional lifetime cap.
 * Creates a shared Allowance object and an AllowanceCap owned by the funder (needed to cancel).
 */
export function buildCreateAllowance(p: {
  funder: string;
  spender: string;
  name: string; // <= 128 bytes, e.g. "Mak — monthly"
  monthlyLimitMinor: bigint;
  expiresAtMs: number;
  lifetimeCapMinor?: bigint;
}) {
  assertPositive(p.monthlyLimitMinor, 'Monthly limit');
  if (new TextEncoder().encode(p.name).length > 128) throw new Error('Name is too long');
  if (p.expiresAtMs <= Date.now()) throw new Error('Expiry must be in the future');
  const tx = new Transaction();
  tx.setSender(normalizeSuiAddress(p.funder));
  const rate = tx.moveCall({ target: '0x2::allowance::monthly_rate_limit', arguments: [tx.pure.u256(p.monthlyLimitMinor)] });
  const [someRate] = tx.moveCall({ target: '0x1::option::some', typeArguments: ['0x2::allowance::RateLimit'], arguments: [rate] });
  tx.moveCall({
    target: '0x2::allowance::new',
    typeArguments: [BAL],
    arguments: [
      tx.pure.string(p.name),
      tx.pure.address(normalizeSuiAddress(p.spender)),
      tx.pure.option('u256', p.lifetimeCapMinor ?? null),
      tx.pure.option('u64', null),
      tx.pure.option('u64', BigInt(p.expiresAtMs)),
      someRate,
    ],
  });
  return tx;
}

/** The spender draws `amountMinor` under the allowance into their own address balance. */
export function buildDrawAllowance(p: { spender: string; funder: string; allowanceId: string; amountMinor: bigint }) {
  assertPositive(p.amountMinor, 'Amount');
  const spender = normalizeSuiAddress(p.spender);
  const allowanceId = normalizeSuiAddress(p.allowanceId);
  const tx = new Transaction();
  tx.setSender(spender);
  const w = tx.withdrawal({
    amount: p.amountMinor,
    type: USD_TYPE,
    from: 'allowance',
    allowance: allowanceId,
    funder: normalizeSuiAddress(p.funder),
  });
  const [funds] = tx.moveCall({
    target: '0x2::allowance::balance_spend',
    typeArguments: [USD_TYPE],
    arguments: [tx.object(allowanceId), w, tx.object.clock()],
  });
  tx.moveCall({ target: '0x2::balance::send_funds', typeArguments: [USD_TYPE], arguments: [funds, tx.pure.address(spender)] });
  return tx;
}

/** The funder cancels: consumes the AllowanceCap and deletes the shared Allowance. */
export function buildRevokeAllowance(p: { funder: string; allowanceId: string; capId: string }) {
  const tx = new Transaction();
  tx.setSender(normalizeSuiAddress(p.funder));
  tx.moveCall({
    target: '0x2::allowance::revoke',
    typeArguments: [BAL],
    arguments: [tx.object(normalizeSuiAddress(p.capId)), tx.object(normalizeSuiAddress(p.allowanceId))],
  });
  return tx;
}
