// FROZEN — verified against @mysten/sui 2.31.3 on Sui testnet. Do not edit.
import { SuiGrpcClient } from '@mysten/sui/grpc';

export const SUI_NETWORK = 'testnet' as const;
// v2 amendment (user-approved): the live testnet chain identifier returned by
// SuiGrpcClient.core.getChainIdentifier() is the base64 chain digest below. The
// hex form '4c78adac' from the original v2 prompt no longer matches what the SDK returns.
export const TESTNET_CHAIN_ID = '69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD';
export const SUI_RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443';
export const SUI_GRAPHQL_URL = process.env.NEXT_PUBLIC_SUI_GRAPHQL_URL ?? 'https://graphql.testnet.sui.io/graphql';
/** Circle testnet USDC on Sui. Shown to users as "USD". */
export const USD_TYPE =
  process.env.NEXT_PUBLIC_USD_COIN_TYPE ??
  '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
export const USD_DECIMALS = 6;
export const CLOCK_ID = '0x6';

export const suiClient = new SuiGrpcClient({ network: SUI_NETWORK, baseUrl: SUI_RPC_URL });

export const explorerTxUrl = (digest: string) => `https://suiscan.xyz/testnet/tx/${digest}`;
export const explorerObjectUrl = (id: string) => `https://suiscan.xyz/testnet/object/${id}`;
export const explorerAccountUrl = (addr: string) => `https://suiscan.xyz/testnet/account/${addr}`;
