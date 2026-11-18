import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session.server';
import { getUsdBalance, getSuiGasBalance } from '@/lib/sui/balance';
import { usdRates } from '@/lib/fx.server';
import { formatInCurrency, CURRENCY_META } from '@/lib/fx';
import type { DisplayCurrency } from '@/lib/fx.server';
import { formatUsd } from '@/lib/sui/money';

export const dynamic = 'force-dynamic';

/** GET /api/portfolio — USD balance, SUI fee balance, rates, formatted fiat rows. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  if (!u.suiAddress) return NextResponse.json({ error: 'Create your account key first.' }, { status: 400 });

  const [bal, gas, rates] = await Promise.all([
    getUsdBalance(u.suiAddress),
    getSuiGasBalance(u.suiAddress),
    usdRates(),
  ]);

  const fiat = ['MYR', 'IDR', 'THB', 'SGD', 'PHP'].map((c) => {
    const cur = c as DisplayCurrency;
    return {
      currency: c,
      symbol: CURRENCY_META[cur].symbol,
      name: CURRENCY_META[cur].name,
      cashOut: CURRENCY_META[cur].cashOut,
      formatted: formatInCurrency(bal.total, cur, rates[cur]),
      rate: rates[cur],
    };
  });

  return NextResponse.json({
    usdMinor: bal.total.toString(),
    usdFormatted: formatUsd(bal.total),
    addressBalanceMinor: bal.addressBalance.toString(),
    coinBalanceMinor: bal.coinBalance.toString(),
    gasMist: gas.toString(),
    fiat,
    ratesAt: rates.at,
    ratesSource: rates.source,
  });
}
