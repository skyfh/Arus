// FROZEN — CLIENT ONLY ('use client' callers). The private key is generated and kept in
// this browser. The server only ever receives the address. Splash cannot move user money.
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const KEY = (userId: string) => `splash.wallet.${userId}`;

export function loadOrCreateWallet(userId: string): Ed25519Keypair {
  if (typeof window === 'undefined') throw new Error('local wallet is browser-only');
  const saved = window.localStorage.getItem(KEY(userId));
  if (saved) return Ed25519Keypair.fromSecretKey(saved);
  const kp = new Ed25519Keypair();
  window.localStorage.setItem(KEY(userId), kp.getSecretKey()); // bech32 "suiprivkey..."
  return kp;
}

export function hasLocalWallet(userId: string) {
  return typeof window !== 'undefined' && !!window.localStorage.getItem(KEY(userId));
}

/** For the "Back up my wallet key" button in Settings. */
export function exportSecret(userId: string) {
  return window.localStorage.getItem(KEY(userId));
}

export function importSecret(userId: string, secret: string) {
  const kp = Ed25519Keypair.fromSecretKey(secret.trim()); // throws if invalid
  window.localStorage.setItem(KEY(userId), kp.getSecretKey());
  return kp;
}
