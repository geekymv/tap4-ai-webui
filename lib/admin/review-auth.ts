import 'server-only';

import { cookies } from 'next/headers';

import { createAdminSessionToken, secretsEqual, verifyAdminSessionToken } from './session-token';

const ADMIN_COOKIE_NAME = 'crawler_admin_session';

export function getReviewAuthKey() {
  return process.env.REVIEW_AUTH_KEY || '';
}

export function verifyReviewKey(candidate: string) {
  const expected = getReviewAuthKey();
  return Boolean(expected && candidate && secretsEqual(candidate, expected));
}

export function verifyReviewAuthorization(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) return false;
  return verifyReviewKey(authorization.slice('Bearer '.length));
}

export function createReviewAdminSession() {
  const key = getReviewAuthKey();
  if (!key) throw new Error('REVIEW_AUTH_KEY is not configured');
  cookies().set(ADMIN_COOKIE_NAME, createAdminSessionToken(key), {
    httpOnly: true,
    maxAge: 8 * 60 * 60,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearReviewAdminSession() {
  cookies().set(ADMIN_COOKIE_NAME, '', {
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function isReviewAdminAuthenticated() {
  const key = getReviewAuthKey();
  if (!key) return false;
  return verifyAdminSessionToken(cookies().get(ADMIN_COOKIE_NAME)?.value, key);
}
