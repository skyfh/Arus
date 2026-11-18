// FROZEN (v2). Cash-out quote maths in integers. USD minor (6dp) -> MYR sen (2dp).
// Rate is applied as an integer with 6 decimal places of precision; result truncated (never rounded up).
export const CASHOUT_FEE_BPS = 30n; // 0.30% demo fee, shown to the user
export const CASHOUT_MIN_MINOR = 5_000_000n; // $5
export const CASHOUT_MAX_MINOR = 1_000_000_000n; // $1,000 (Basic tier)

export type Destination = 'RYT_BANK' | 'TNG_EWALLET' | 'OTHER_DUITNOW' | 'JOMPAY_BILL';

export function quoteCashOut(amountMinor: bigint, usdMyr: number) {
  if (amountMinor < CASHOUT_MIN_MINOR) throw new Error('Minimum cash out is $5');
  if (amountMinor > CASHOUT_MAX_MINOR) throw new Error('Maximum cash out is $1,000 per transaction');
  const feeMinor = (amountMinor * CASHOUT_FEE_BPS + 9_999n) / 10_000n; // fee rounded up
  const netMinor = amountMinor - feeMinor;
  const rate6 = BigInt(Math.floor(usdMyr * 1_000_000)); // MYR per USD x1e6
  // netMinor (1e6) * rate6 (1e6) -> sen (1e2): divide by 1e10
  const myrSen = (netMinor * rate6) / 10_000_000_000n;
  return { amountMinor, feeMinor, netMinor, rate: usdMyr, myrSen };
}

export const formatMyr = (sen: bigint) =>
  `RM ${(sen / 100n).toLocaleString('en-US')}.${(sen % 100n).toString().padStart(2, '0')}`;

/** JomPAY biller code: 4–6 digits. */
export const validBillerCode = (c: string) => /^\d{4,6}$/.test(c.trim());

/** Malaysian mobile (DuitNow ID for Touch 'n Go) or a 6–17 digit bank account number. */
export function validateDestination(d: Destination, id: string): string {
  const s = id.replace(/[\s-]/g, '');
  if (d === 'TNG_EWALLET') {
    if (!/^(\+?60|0)1\d{8,9}$/.test(s)) throw new Error('Enter the Malaysian mobile number linked to Touch ’n Go eWallet');
    return s;
  }
  if (d === 'JOMPAY_BILL') {
    if (!/^[A-Za-z0-9]{1,30}$/.test(s)) throw new Error('Enter the bill reference number (Ref-1)');
    return s;
  }
  if (!/^\d{6,17}$/.test(s)) throw new Error('Enter a valid account number');
  return s;
}

export const last4 = (s: string) => s.slice(-4);
