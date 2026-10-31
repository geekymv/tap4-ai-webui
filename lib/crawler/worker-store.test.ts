import { describe, expect, it } from 'vitest';

import { CrawlCandidate } from './store-factory';
import createTestDatabase from './test-d1';
import createCrawlerWorkerStore from './worker-store-factory';

const candidate = {
  attempt_count: 1,
  canonical_url: 'https://example.com/',
  category_name: null,
  description: null,
  detail: null,
  domain: 'example.com',
  id: 1,
  image_url: null,
  source: 'github',
  source_item_id: null,
  status: 'processing',
  title: null,
  url: 'https://example.com/',
} as CrawlCandidate;

const resultInput = {
  candidateId: 1,
  canonicalUrl: 'https://example.com/',
  categoryName: 'writing',
  description: 'A factual summary of the product and its supported workflow.',
  detail: '### Overview\n\nDetailed content.\n\n### Features\n\nFeatures.\n\n### Usage\n\nUsage.',
  imageUrl: null,
  leaseToken: 'a'.repeat(43),
  title: 'Example',
};

describe('D1 external crawler worker store', () => {
  it('claims jobs with a hashed, expiring lease', async () => {
    let leaseHash: unknown;
    const { database } = createTestDatabase((query, values) => {
      if (query.startsWith('SELECT id')) return [{ id: 1 }];
      if (query.includes('UPDATE crawler_candidate')) {
        [leaseHash] = values;
        return [candidate];
      }
      return [];
    });
    const [claimed] = await createCrawlerWorkerStore(database).claim(1);
    expect(claimed.leaseToken).toHaveLength(43);
    expect(leaseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(leaseHash).not.toBe(claimed.leaseToken);
  });

  it('rejects an inactive category and cross-site URLs', async () => {
    const { database } = createTestDatabase((query) => {
      if (query.includes("status = 'processing'")) return [candidate];
      return [];
    });
    const store = createCrawlerWorkerStore(database);
    await expect(store.complete(resultInput)).rejects.toThrow('invalid_category');
    await expect(store.complete({ ...resultInput, canonicalUrl: 'https://attacker.example/' })).rejects.toThrow(
      'invalid_canonical_origin',
    );
    await expect(store.complete({ ...resultInput, imageUrl: 'https://tracker.example/pixel.png' })).rejects.toThrow(
      'invalid_image_origin',
    );
  });

  it('returns the existing publication for an idempotent retry', async () => {
    const { database } = createTestDatabase((query) => {
      if (query.includes("status = 'processing'")) return [];
      if (query.includes("status = 'published'")) {
        return [{ canonical_url: candidate.canonical_url, category_name: 'writing' }];
      }
      if (query.includes('SELECT name FROM web_navigation')) return [{ name: 'existing-tool' }];
      return [];
    });
    await expect(createCrawlerWorkerStore(database).complete(resultInput)).resolves.toEqual({
      categoryName: 'writing',
      name: 'existing-tool',
      status: 'published',
    });
  });

  it('publishes a matching live lease in an atomic D1 batch', async () => {
    const { database, queries } = createTestDatabase((query) => {
      if (query.includes("status = 'processing'")) return [candidate];
      if (query.includes('SELECT name FROM navigation_category')) return [{ name: 'writing' }];
      return [];
    });
    await expect(
      createCrawlerWorkerStore(database).complete({ ...resultInput, imageUrl: 'https://www.example.com/image.png' }),
    ).resolves.toEqual({ categoryName: 'writing', name: 'example-com-1', status: 'published' });
    expect(queries.some(({ query }) => query.includes('INSERT INTO web_navigation'))).toBe(true);
  });
});
