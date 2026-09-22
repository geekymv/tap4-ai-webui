import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function secretsEqual(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected));
}

function signature(payload: string, key: string) {
  return createHmac('sha256', key).update(payload).digest('hex');
}

export function createAdminSessionToken(key: string, now = Date.now(), nonce = randomBytes(16).toString('hex')) {
  const expiresAt = now + ADMIN_SESSION_TTL_MS;
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${signature(payload, key)}`;
}

export function verifyAdminSessionToken(token: string | undefined, key: string, now = Date.now()) {
  if (!token) return false;
  const [expiresValue, nonce, suppliedSignature, ...rest] = token.split('.');
  if (!expiresValue || !nonce || !suppliedSignature || rest.length) return false;
  const expiresAt = Number(expiresValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + ADMIN_SESSION_TTL_MS) return false;
  const payload = `${expiresValue}.${nonce}`;
  return secretsEqual(suppliedSignature, signature(payload, key));
}
