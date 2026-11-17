import { cookies } from 'next/headers';
import { User, UserRole } from '../types';

export const SESSION_COOKIE_NAME = 'pocketlog_session';
export const TRUSTED_DEVICE_COOKIE_NAME = 'pocketlog_device_token';

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string;
  currency: string;
  expiresAt: number; // Unix timestamp in seconds
}

// Dynamically resolve session secret from environment variables
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY CONFIGURATION ERROR: SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.'
      );
    }
    return 'dev_insecure_local_session_secret_only';
  }
  return secret;
}

/**
 * Computes a SHA-256 hash formatted as lowercase hex.
 * Compatible with Edge and Node.js environments.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically secure random token (32 bytes hex).
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates an HMAC-SHA256 signature for a payload string.
 */
async function signData(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a signed, tamper-proof session token.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const jsonStr = JSON.stringify(payload);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = await signData(base64Data, getSessionSecret());
  return `${base64Data}.${signature}`;
}

/**
 * Verifies a signed session token. Returns null if expired or tampered with.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || !token.includes('.')) return null;
  const [base64Data, signature] = token.split('.');
  if (!base64Data || !signature) return null;

  try {
    const expectedSig = await signData(base64Data, getSessionSecret());
    if (signature !== expectedSig) {
      return null; // Tampered token
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(jsonStr);

    // Check expiration (30 days default)
    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt && payload.expiresAt < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * In-memory failed attempt tracker for brute-force mitigation (rate limiting).
 * Keys are mapped to: { attempts: number, lockedUntil: number }
 */
const rateLimitCache = new Map<string, { attempts: number; lockedUntil: number }>();

function checkRateLimit(key: string): { isLocked: boolean; waitSeconds?: number } {
  const record = rateLimitCache.get(key);
  if (!record) return { isLocked: false };

  const now = Date.now();
  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, waitSeconds };
  }

  if (record.lockedUntil <= now && record.attempts >= 5) {
    // Lockout expired, reset attempts
    rateLimitCache.delete(key);
    return { isLocked: false };
  }

  return { isLocked: false };
}

function recordFailedAttempt(key: string): { remainingAttempts: number; isLocked: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000; // 5 minutes lockout (300 seconds)
    rateLimitCache.set(key, record);
    return { remainingAttempts: 0, isLocked: true, waitSeconds: 300 };
  }

  rateLimitCache.set(key, record);
  return { remainingAttempts: 5 - record.attempts, isLocked: false };
}

function resetRateLimit(key: string): void {
  rateLimitCache.delete(key);
}

// 1. PIN Lockout
export function checkPinLockout(identifier: string): { isLocked: boolean; waitSeconds?: number } {
  return checkRateLimit(`pin:${identifier.toLowerCase().trim()}`);
}

export function recordFailedPinAttempt(identifier: string): { remainingAttempts: number; isLocked: boolean; waitSeconds?: number } {
  return recordFailedAttempt(`pin:${identifier.toLowerCase().trim()}`);
}

export function resetPinAttempts(identifier: string): void {
  resetRateLimit(`pin:${identifier.toLowerCase().trim()}`);
}

// 2. Password Lockout (5 attempts limit)
export function checkPasswordLockout(identifier: string): { isLocked: boolean; waitSeconds?: number } {
  return checkRateLimit(`password:${identifier.toLowerCase().trim()}`);
}

export function recordFailedPasswordAttempt(identifier: string): { remainingAttempts: number; isLocked: boolean; waitSeconds?: number } {
  return recordFailedAttempt(`password:${identifier.toLowerCase().trim()}`);
}

export function resetPasswordAttempts(identifier: string): void {
  resetRateLimit(`password:${identifier.toLowerCase().trim()}`);
}

// 3. Trusted Device Token Lockout (5 attempts limit)
export function checkDeviceTokenLockout(identifier: string): { isLocked: boolean; waitSeconds?: number } {
  return checkRateLimit(`device_token:${identifier.toLowerCase().trim()}`);
}

export function recordFailedDeviceTokenAttempt(identifier: string): { remainingAttempts: number; isLocked: boolean; waitSeconds?: number } {
  return recordFailedAttempt(`device_token:${identifier.toLowerCase().trim()}`);
}

export function resetDeviceTokenAttempts(identifier: string): void {
  resetRateLimit(`device_token:${identifier.toLowerCase().trim()}`);
}

/**
 * Resolves current user session from HttpOnly cookies in a Server Component or Action.
 */
export async function getActiveSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  return await verifySessionToken(sessionCookie.value);
}

/**
 * Parses session duration values into seconds.
 * Supports numeric seconds (e.g. 86400) or strings like "1d", "24h", "60m".
 * Defaults to 86400 seconds (1 day).
 */
export function parseSessionDuration(val?: string | number | null): number {
  if (!val) return 86400;
  if (typeof val === 'number') return val > 0 ? Math.floor(val) : 86400;

  const trimmed = String(val).trim().toLowerCase();
  const numericOnly = Number(trimmed);
  if (!isNaN(numericOnly) && numericOnly > 0) {
    return Math.floor(numericOnly);
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)?$/);
  if (match) {
    const amount = parseFloat(match[1]);
    const unit = match[2] || 's';
    if (unit.startsWith('d')) {
      return Math.floor(amount * 86400);
    }
    if (unit.startsWith('h')) {
      return Math.floor(amount * 3600);
    }
    if (unit.startsWith('m')) {
      return Math.floor(amount * 60);
    }
    return Math.floor(amount);
  }

  return 86400;
}

/**
 * Returns session expiration in seconds from environment variable (default: 86400 = 1 day).
 */
export function getSessionExpirationSeconds(): number {
  const envVal =
    process.env.SESSION_EXPIRATION_SECONDS ||
    process.env.NEXT_PUBLIC_SESSION_EXPIRATION_SECONDS ||
    process.env.SESSION_MAX_AGE ||
    process.env.SESSION_LIFETIME;

  return parseSessionDuration(envVal);
}

/**
 * Sets session cookie with strict security flags and configured maxAge.
 */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = getSessionExpirationSeconds();
  const now = Math.floor(Date.now() / 1000);

  const sessionPayload: SessionPayload = {
    ...payload,
    expiresAt: payload.expiresAt || (now + maxAge),
  };

  const token = await createSessionToken(sessionPayload);
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

/**
 * Clears session cookies on logout.
 * Keeps trusted device authorization intact so the device remains ready for PIN unlock.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Checks whether an input device token matches any authorized tokens in environment variables.
 * Supports comma-separated tokens in TRUSTED_DEVICE_TOKEN or single values in TRUSTED_DEVICE_KEY / DEVICE_SECRET.
 */
export function isTrustedDeviceTokenValid(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const envTokens = [
    process.env.TRUSTED_DEVICE_TOKEN,
    process.env.TRUSTED_DEVICE_KEY,
    process.env.DEVICE_SECRET,
  ].filter(Boolean) as string[];

  const validTokens = envTokens.flatMap((t) => t.split(',').map((s) => s.trim()));
  if (validTokens.length === 0) return false;

  return validTokens.includes(token.trim());
}

/**
 * Generates an HMAC-derived signed cookie value for a valid trusted device token.
 */
export async function createTrustedDeviceCookieValue(deviceToken: string): Promise<string> {
  return await sha256(`trusted_device_${deviceToken.trim()}_${getSessionSecret()}`);
}

/**
 * Verifies if the current browser session has a valid trusted device cookie.
 */
export async function isCurrentDeviceTrusted(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
    if (!cookieValue) return false;

    const envTokens = [
      process.env.TRUSTED_DEVICE_TOKEN,
      process.env.TRUSTED_DEVICE_KEY,
      process.env.DEVICE_SECRET,
    ].filter(Boolean) as string[];

    const validTokens = envTokens.flatMap((t) => t.split(',').map((s) => s.trim()));
    if (validTokens.length === 0) {
      return false;
    }

    for (const t of validTokens) {
      const expected = await createTrustedDeviceCookieValue(t);
      if (cookieValue === expected || cookieValue === t) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Sets the trusted device cookie on the response store (1 year lifetime).
 */
export async function setTrustedDeviceCookie(deviceToken: string): Promise<boolean> {
  if (!isTrustedDeviceTokenValid(deviceToken)) {
    return false;
  }

  const cookieStore = await cookies();
  const cookieValue = await createTrustedDeviceCookieValue(deviceToken);
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set(TRUSTED_DEVICE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60, // 365 days
  });

  return true;
}

/**
 * Removes the trusted device cookie.
 */
export async function clearTrustedDeviceCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE_NAME);
}
