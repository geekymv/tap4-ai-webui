import { describe, expect, it } from 'vitest';

import { ADMIN_SESSION_TTL_MS, createAdminSessionToken, secretsEqual, verifyAdminSessionToken } from './session-token';

describe('admin session tokens', () => {
  it('accepts a valid signed token before it expires', () => {
    const now = 1_700_000_000_000;
    const token = createAdminSessionToken('review-secret', now, 'fixed-nonce');

    expect(verifyAdminSessionToken(token, 'review-secret', now + 1000)).toBe(true);
  });

  it('rejects tampered, expired, and incorrectly signed tokens', () => {
    const now = 1_700_000_000_000;
    const token = createAdminSessionToken('review-secret', now, 'fixed-nonce');

    expect(verifyAdminSessionToken(`${token}0`, 'review-secret', now)).toBe(false);
    expect(verifyAdminSessionToken(token, 'different-secret', now)).toBe(false);
    expect(verifyAdminSessionToken(token, 'review-secret', now + ADMIN_SESSION_TTL_MS)).toBe(false);
  });

  it('compares secrets without depending on equal input lengths', () => {
    expect(secretsEqual('same', 'same')).toBe(true);
    expect(secretsEqual('short', 'a-much-longer-secret')).toBe(false);
  });
});
