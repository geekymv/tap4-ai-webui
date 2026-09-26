import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
  reviewCandidate: vi.fn(),
  store: {},
}));

vi.mock('@/lib/admin/review-auth', () => ({ verifyReviewAuthorization: () => true }));
vi.mock('@/lib/crawler/review', () => ({ default: mocks.reviewCandidate }));
vi.mock('@/lib/crawler/store', () => ({ default: () => mocks.store }));

describe('crawler review API', () => {
  beforeEach(() => {
    mocks.reviewCandidate.mockReset();
    mocks.reviewCandidate.mockRejectedValue(new Error('invalid_category'));
  });

  it('allows an authenticated review candidate to be requeued for rewriting', async () => {
    mocks.reviewCandidate.mockResolvedValue({ status: 'pending' });
    const request = new NextRequest('http://localhost/api/crawl/review/1', {
      body: JSON.stringify({ action: 'rewrite' }),
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const response = await POST(request, { params: { id: '1' } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'pending' });
    expect(mocks.reviewCandidate).toHaveBeenCalledWith(mocks.store, 1, 'rewrite', undefined);
  });

  it('rejects an unknown category instead of publishing it', async () => {
    const request = new NextRequest('http://localhost/api/crawl/review/1', {
      body: JSON.stringify({ action: 'approve', categoryName: 'internal-only' }),
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const response = await POST(request, { params: { id: '1' } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_category' });
    expect(mocks.reviewCandidate).toHaveBeenCalledWith(mocks.store, 1, 'approve', 'internal-only');
  });
});
