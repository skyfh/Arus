// FROZEN. Reads a USD balance split into address balance (spendable by allowances)
// and coin objects (e.g. what a faucet sends). Total = both.
import { SUI_GRAPHQL_URL, USD_TYPE } from './config';

export type UsdBalance = { total: bigint; addressBalance: bigint; coinBalance: bigint };

async function gql(query: string) {
  const res = await fetch(SUI_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });
  return res.json();
}

export async function getUsdBalance(owner: string): Promise<UsdBalance> {
  const j = await gql(
    `{ address(address:"${owner}") { balance(coinType:"${USD_TYPE}") { totalBalance addressBalance coinBalance } } }`,
  );
  if (!j.errors) {
    const b = j.data?.address?.balance;
    return {
      total: BigInt(b?.totalBalance ?? 0),
      addressBalance: BigInt(b?.addressBalance ?? 0),
      coinBalance: BigInt(b?.coinBalance ?? 0),
    };
  }
  // Older schema: only totalBalance. Treat it all as coins (safe: we consolidate before allowances).
  const j2 = await gql(`{ address(address:"${owner}") { balance(coinType:"${USD_TYPE}") { totalBalance } } }`);
  const t = BigInt(j2.data?.address?.balance?.totalBalance ?? 0);
  return { total: t, addressBalance: 0n, coinBalance: t };
}

export async function getSuiGasBalance(owner: string): Promise<bigint> {
  const j = await gql(`{ address(address:"${owner}") { balance(coinType:"0x2::sui::SUI") { totalBalance } } }`);
  return BigInt(j.data?.address?.balance?.totalBalance ?? 0);
}
