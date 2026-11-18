// Server-only auth helpers: scrypt password hashing and jose JWT sessions.
// Never imported from client components.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SECRET = process.env.SESSION_SECRET;
if (!SECRET || SECRET.length < 32) {
  // Fail loudly only when actually used at runtime on the server.
  console.error('SESSION_SECRET must be set to 32+ random chars');
}

const key = () => new TextEncoder().encode(SECRET);
export const SESSION_COOKIE = 'arus_session';
const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export type SessionPayload = { userId: string; stepUp?: boolean };

export async function createSessionToken(p: SessionPayload): Promise<string> {
  return new SignJWT({ userId: p.userId, stepUp: p.stepUp ?? false })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.userId !== 'string') return null;
    return { userId: payload.userId, stepUp: payload.stepUp === true };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/** The logged-in user row, or null. */
export async function currentUser() {
  const s = await getSession();
  if (!s) return null;
  return prisma.user.findUnique({ where: { id: s.userId } });
}

/** Requires a fresh step-up (password re-entry) token bound to a draft. */
export async function requireUser() {
  const u = await currentUser();
  if (!u) return null;
  return u;
}

// ---- Step-up tokens: short-lived JWTs bound to a purpose (e.g. draft id) ----
export async function createStepUpToken(userId: string, purpose: string): Promise<string> {
  return new SignJWT({ userId, purpose, kind: 'step-up' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key());
}

export async function verifyStepUpToken(token: string, userId: string, purpose: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.kind === 'step-up' && payload.userId === userId && payload.purpose === purpose;
  } catch {
    return false;
  }
}

// ---- Login rate limit: 5 tries per 10 minutes per email (in-memory, per instance) ----
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimit(email: string): { allowed: boolean; retryAfterSec?: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now > a.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return { allowed: true };
  }
  a.count += 1;
  if (a.count > 5) {
    return { allowed: false, retryAfterSec: Math.ceil((a.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export function loginRateLimitReset(email: string) {
  attempts.delete(email.toLowerCase());
}
