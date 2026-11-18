// FROZEN (v2) — SERVER ONLY. USD -> display currencies. Arus HOLDS ONLY USD;
// these rates only show what the USD balance is worth. Cached 60s. Never invents a rate:
// a currency with no rate is returned as null and the UI shows "—".
// Offline override: DEMO_FX_JSON='{"MYR":4.41,"IDR":15900,"THB":35.2,"SGD":1.34,"PHP":58.5}'
export const DISPLAY_CURRENCIES = ['MYR', 'IDR', 'THB', 'SGD', 'PHP'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
export type UsdRates = Record<DisplayCurrency, number | null> & { at: string; source: string };

let cache: { at: number; value: UsdRates } | null = null;

export async function usdRates(): Promise<UsdRates> {
  if (process.env.DEMO_FX_JSON) {
    const o = JSON.parse(process.env.DEMO_FX_JSON) as Record<string, number>;
    return { ...pick(o), at: new Date().toISOString(), source: 'demo override' };
  }
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    const j = await r.json();
    const value: UsdRates = { ...pick(j?.rates ?? {}), at: new Date().toISOString(), source: 'open.er-api.com' };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    if (cache) return cache.value;
    return { MYR: null, IDR: null, THB: null, SGD: null, PHP: null, at: new Date().toISOString(), source: 'unavailable' };
  }
}

function pick(o: Record<string, unknown>) {
  const out = {} as Record<DisplayCurrency, number | null>;
  for (const c of DISPLAY_CURRENCIES) {
    const v = o[c];
    out[c] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }
  return out;
}
