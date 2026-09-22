import { describe, expect, it } from 'vitest';

import reviewCandidate from './review';
import { CrawlerStore } from './store';

describe('reviewCandidate', () => {
  it('allows only one of two concurrent approvals to succeed', async () => {
    let status: 'review' | 'published' = 'review';
    const store = {
      reviewCandidate: async () => {
        await Promise.resolve();
        if (status !== 'review') throw new Error('candidate_not_reviewable');
        status = 'published';
        return { name: 'example-1', status: 'published' as const };
      },
    } as unknown as CrawlerStore;

    const results = await Promise.allSettled([
      reviewCandidate(store, 1, 'approve'),
      reviewCandidate(store, 1, 'approve'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('propagates transactional state update failures', async () => {
    const store = {
      reviewCandidate: async () => {
        throw new Error('submit update failed');
      },
    } as unknown as CrawlerStore;
    await expect(reviewCandidate(store, 1, 'reject')).rejects.toThrow('submit update failed');
  });

  it('rejects an unknown category before publishing', async () => {
    let published = false;
    const store = {
      listCategories: async () => [{ name: 'writing', title: 'AI Writing' }],
      reviewCandidate: async () => {
        published = true;
        return { name: 'example-1', status: 'published' as const };
      },
    } as unknown as CrawlerStore;

    await expect(reviewCandidate(store, 1, 'approve', 'internal-only')).rejects.toThrow('invalid_category');
    expect(published).toBe(false);
  });
});
