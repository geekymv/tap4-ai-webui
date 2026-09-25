import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  listCategories: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('@/lib/crawler/worker-auth', () => ({ default: mocks.verify }));
vi.mock('@/lib/crawler/worker-contract', () => ({
  workerClaimSchema: { parse: (value: { limit?: number }) => ({ limit: value.limit || 5 }) },
}));
vi.mock('@/lib/crawler/worker-store', () => ({
  default: () => ({ claim: mocks.claim, listCategories: mocks.listCategories }),
}));

describe('crawler worker claim API', () => {
  beforeEach(() => {
    mocks.claim.mockReset();
    mocks.listCategories.mockReset();
    mocks.verify.mockReset();
    mocks.verify.mockReturnValue(true);
    mocks.listCategories.mockResolvedValue([{ name: 'writing', title: 'AI Writing' }]);
    mocks.claim.mockResolvedValue([
      { attempt_count: 1, id: 1, leaseToken: 'lease-token', url: 'https://example.com/' },
    ]);
  });

  it('requires the dedicated worker authorization', async () => {
    mocks.verify.mockReturnValue(false);
    const response = await POST(new NextRequest('http://localhost/api/crawl/worker/claim', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('returns leased candidates and the active category whitelist', async () => {
    const request = new NextRequest('http://localhost/api/crawl/worker/claim', {
      body: JSON.stringify({ limit: 2 }),
      headers: { authorization: 'Bearer worker-key', 'content-type': 'application/json' },
      method: 'POST',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      candidates: [{ attemptCount: 1, id: 1, leaseToken: 'lease-token', url: 'https://example.com/' }],
      categories: [{ name: 'writing', title: 'AI Writing' }],
    });
    expect(mocks.claim).toHaveBeenCalledWith(2);
  });
});
