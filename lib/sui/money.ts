// FROZEN. All money is bigint minor units (6 decimals). Never use floats for money.
import { USD_DECIMALS } from './config';

const SCALE = 10n ** BigInt(USD_DECIMALS);

/** "12.5" -> 12_500_000n. Throws on bad input or more than 6 decimals. */
export function usdToMinor(input: string): bigint {
  const s = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error('Enter an amount like 25 or 25.50');
  const [whole, frac = ''] = s.split('.');
  return BigInt(whole) * SCALE + BigInt((frac + '000000').slice(0, USD_DECIMALS));
}

/** 12_500_000n -> "12.50" (2 decimals for display, truncated, never rounded up). */
export function minorToUsd(minor: bigint | string | number): string {
  const n = BigInt(minor);
  const neg = n < 0n;
  const a = neg ? -n : n;
  const whole = a / SCALE;
  const cents = ((a % SCALE) / 10_000n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${whole.toLocaleString('en-US')}.${cents}`;
}

export const formatUsd = (minor: bigint | string | number) => `$${minorToUsd(minor)}`;
