// name@arus handle rules. Shared by client and server.
export const RESERVED_HANDLES = [
  'admin', 'support', 'arus', 'splash', 'zeke', 'help', 'security', 'official',
  'bank', 'ryt', 'tng', 'touchngo', 'bnm',
] as const;

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function handleValid(h: string): boolean {
  return HANDLE_RE.test(h.trim().toLowerCase()) && !RESERVED_HANDLES.includes(h.trim().toLowerCase() as never);
}

/** Reserved handles get this exact refusal sentence. */
export function handleRefusal(h: string): string {
  if (RESERVED_HANDLES.includes(h.trim().toLowerCase() as never)) {
    return 'That name is reserved. Please pick a different handle.';
  }
  return 'Handles are 3-20 lowercase letters, numbers or underscores.';
}
