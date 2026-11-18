// FROZEN (v2). Zeke-specific caps, stricter than manual flows because on-chain transfers are final.
export const ZEKE_MAX_PER_TX_MINOR = 100_000_000n; // $100
export const ZEKE_MAX_PER_DAY_MINOR = 300_000_000n; // $300 (Zeke-drafted, confirmed, per UTC day)
export const ZEKE_STEP_UP_ABOVE_MINOR = 50_000_000n; // password re-entry above $50
export const DRAFT_TTL_MS = 10 * 60_000; // drafts expire after 10 minutes
export const DUPLICATE_WINDOW_MS = 10 * 60_000; // same recipient + amount within 10 min -> ask "send again?"
export const ZEKE_MSGS_PER_HOUR = 30;
