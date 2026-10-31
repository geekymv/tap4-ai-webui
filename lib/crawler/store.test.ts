import { describe, expect, it } from 'vitest';

import createCrawlerStore, { CrawlCandidate } from './store-factory';
import createTestDatabase from './test-d1';

const candidate = {
  attempt_count: 1,
  canonical_url: 'https://example.com/',
  category_name: 'writing',
  description: 'A complete description.',
  detail: '## Complete detail',
  domain: 'example.com',
  id: 1,
  image_url: null,
  source: 'github',
  source_item_id: null,
  status: 'review',
  title: 'Example',
  url: 'https://example.com/',
} as CrawlCandidate;

describe('D1 crawler store', () => {
  it('keeps large detail content out of the review queue query', async () => {
    const { database, queries } = createTestDatabase((query) => (query.includes('COUNT(*)') ? [{ count: 0 }] : []));
    await createCrawlerStore(database).listReviewCandidates(0, 12);
    const query = queries.find(({ query: value }) => value.includes('ORDER BY updated_at'))?.query;
    expect(query).toBeDefined();
    expect(query).not.toContain('SELECT *');
    expect(query).toContain('detail IS NOT NULL AS has_detail');
  });

  it('publishes a processed candidate through an atomic D1 batch', async () => {
    const processing = { ...candidate, status: 'processing' };
    const { database, queries } = createTestDatabase((query) => {
      if (query.includes("status = 'processing'")) return [processing];
      if (query.includes('SELECT name FROM navigation_category')) return [{ name: 'writing' }];
      return [];
    });
    await expect(
      createCrawlerStore(database).publishCandidate(1, {
        canonicalUrl: candidate.canonical_url,
        categoryName: 'writing',
        description: candidate.description!,
        detail: candidate.detail!,
        imageUrl: null,
        title: candidate.title!,
      }),
    ).resolves.toEqual({ categoryName: 'writing', name: 'example-com-1', status: 'published' });
    expect(queries.some(({ query }) => query.includes('INSERT INTO web_navigation'))).toBe(true);
    expect(queries.some(({ query }) => query.includes("status = 'published'"))).toBe(true);
  });

  it('rejects an inactive category before publication', async () => {
    const { database, queries } = createTestDatabase((query) => {
      if (query.includes("status = 'review'")) return [candidate];
      return [];
    });
    await expect(createCrawlerStore(database).reviewCandidate(1, 'approve')).rejects.toThrow('invalid_category');
    expect(queries.some(({ query }) => query.includes('INSERT INTO web_navigation'))).toBe(false);
  });

  it('requeues a review candidate and resets lease state', async () => {
    const { database, queries } = createTestDatabase((query) => {
      if (query.includes("status = 'review'")) return [candidate];
      return [];
    });
    await expect(createCrawlerStore(database).reviewCandidate(1, 'rewrite')).resolves.toEqual({ status: 'pending' });
    const query = queries.find(({ query: value }) => value.includes("status = 'pending'"))?.query || '';
    expect(query).toContain('attempt_count = 0');
    expect(query).toContain('worker_lease_hash = NULL');
  });
});
