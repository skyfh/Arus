// FROZEN — SERVER ONLY. Stores a payment receipt on Walrus testnet. Never blocks a payment:
// callers save the receipt first, then call this and update walrusBlobId when it returns.
import { createHash } from 'node:crypto';

const PUBLISHER = process.env.WALRUS_PUBLISHER_URL ?? 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ?? 'https://aggregator.walrus-testnet.walrus.space';

/** Stable JSON (sorted keys) so the hash is reproducible by anyone. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

export async function storeReceiptOnWalrus(receipt: Record<string, unknown>) {
  const body = canonicalJson(receipt);
  const hash = sha256Hex(body);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=5`, { method: 'PUT', body, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`walrus ${res.status}`);
      const j = await res.json();
      const blobId: string | undefined = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
      if (!blobId) throw new Error('walrus: no blobId');
      return { blobId, sha256: hash, url: `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}` };
    } catch (e) {
      if (attempt === 2) return { blobId: null, sha256: hash, url: null, error: String(e) };
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return { blobId: null, sha256: hash, url: null };
}
