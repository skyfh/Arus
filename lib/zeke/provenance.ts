// FROZEN (v2) — SERVER ONLY. Deterministic checks the model cannot bypass.
import { normalizeSuiAddress } from '@mysten/sui/utils';

const ADDR = /0x[0-9a-fA-F]{64}/g;

/** True only if `address` appears verbatim in text the USER typed (not tool results, not images). */
export function addressTypedByUser(address: string, userMessages: string[]): boolean {
  const target = normalizeSuiAddress(address);
  return userMessages.some((m) => (m.match(ADDR) ?? []).some((a) => normalizeSuiAddress(a) === target));
}

/** Lookalike: same first 6 and last 4 hex chars as a past counterparty, but a different address. */
export function lookalikeOf(address: string, known: string[]): string | null {
  const a = normalizeSuiAddress(address);
  const head = a.slice(2, 8), tail = a.slice(-4);
  for (const k of known) {
    const n = normalizeSuiAddress(k);
    if (n !== a && n.slice(2, 8) === head && n.slice(-4) === tail) return n;
  }
  return null;
}

/** "rm 50" style amounts -> USD minor using the live MYR rate (MYR per USD). Truncates; never rounds up. */
export function toUsdMinor(amount: string, currency: 'USD' | 'MYR', myrPerUsd: number | null): bigint {
  const [w, f = ''] = amount.split('.');
  const minor = BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
  if (currency === 'USD') return minor;
  if (myrPerUsd === null) throw new Error('Rate unavailable — try again');
  const rate6 = BigInt(Math.floor(myrPerUsd * 1_000_000));
  return (minor * 1_000_000n) / rate6; // MYR minor (6dp) / (MYR per USD) = USD minor
}

export const URGENCY = /\b(urgent|segera|cepat|now|immediately|police|polis|lhdn|frozen|beku|arrest|tangkap)\b/i;
