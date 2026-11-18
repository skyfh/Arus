// FROZEN (v2). Display maths only — integer, truncated, never rounded up.
import type { DisplayCurrency } from './fx.server';

export const CURRENCY_META: Record<'USD' | DisplayCurrency, { symbol: string; name: string; decimals: number; cashOut: 'live' | 'soon' }> = {
  USD: { symbol: '$', name: 'US Dollar', decimals: 2, cashOut: 'live' },
  MYR: { symbol: 'RM ', name: 'Malaysia', decimals: 2, cashOut: 'live' },
  IDR: { symbol: 'Rp ', name: 'Indonesia', decimals: 0, cashOut: 'soon' },
  THB: { symbol: '฿ ', name: 'Thailand', decimals: 2, cashOut: 'soon' },
  SGD: { symbol: 'S$ ', name: 'Singapore', decimals: 2, cashOut: 'soon' },
  PHP: { symbol: '₱ ', name: 'Philippines', decimals: 2, cashOut: 'soon' },
};

/** usdMinor (6dp) x rate -> formatted local amount, e.g. "RM 110.30", "Rp 397,500". null rate -> "—". */
export function formatInCurrency(usdMinor: bigint, currency: DisplayCurrency, rate: number | null): string {
  if (rate === null) return '—';
  const meta = CURRENCY_META[currency];
  const rate6 = BigInt(Math.floor(rate * 1_000_000));
  const hundredths = (usdMinor * rate6) / 10_000_000_000n; // 1e6 * 1e6 / 1e10 = 1e2
  const whole = hundredths / 100n;
  const frac = (hundredths % 100n).toString().padStart(2, '0');
  return `${meta.symbol}${whole.toLocaleString('en-US')}${meta.decimals ? '.' + frac : ''}`;
}
