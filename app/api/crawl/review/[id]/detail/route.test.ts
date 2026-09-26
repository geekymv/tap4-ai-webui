import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const mocks = vi.hoisted(() => ({
  authenticated: vi.fn(),
  getReviewCandidateDetail: vi.fn(),
}));

vi.mock('@/lib/admin/review-auth', () => ({ isReviewAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/crawler/store', () => ({
  default: () => ({ getReviewCandidateDetail: mocks.getReviewCandidateDetail }),
}));

describe('crawler candidate detail API', () => {
  beforeEach(() => {
    mocks.authenticated.mockReset();
    mocks.authenticated.mockReturnValue(true);
    mocks.getReviewCandidateDetail.mockReset();
  });

  it('loads detail only for an authenticated review candidate', async () => {
    mocks.getReviewCandidateDetail.mockResolvedValue({ detail: '## Candidate detail' });

    const response = await GET(new Request('http://localhost/api/crawl/review/42/detail'), {
      params: { id: '42' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ detail: '## Candidate detail' });
    expect(mocks.getReviewCandidateDetail).toHaveBeenCalledWith(42);
  });

  it('does not query candidate data without an admin session', async () => {
    mocks.authenticated.mockReturnValue(false);

    const response = await GET(new Request('http://localhost/api/crawl/review/42/detail'), {
      params: { id: '42' },
    });

    expect(response.status).toBe(401);
    expect(mocks.getReviewCandidateDetail).not.toHaveBeenCalled();
  });

  it('returns not found when the candidate has left the review queue', async () => {
    mocks.getReviewCandidateDetail.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/crawl/review/42/detail'), {
      params: { id: '42' },
    });

    expect(response.status).toBe(404);
  });
});
