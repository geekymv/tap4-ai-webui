import { Sql } from 'postgres';
import { describe, expect, it, vi } from 'vitest';

import { CrawlCandidate } from './store-factory';
import createCrawlerWorkerStore from './worker-store-factory';

function createStore(handler: (query: string, values: unknown[]) => unknown) {
  const transaction = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    Promise.resolve(handler(strings.join('?'), values)),
  );
  const sql = {
    begin: async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as unknown as Sql;
  return { store: createCrawlerWorkerStore(sql), transaction };
}

const candidate = {
  attempt_count: 0,
  canonical_url: 'https://example.com/',
  category_name: null,
  description: null,
  detail: null,
  domain: 'example.com',
  id: 1,
  image_url: null,
  source: 'github',
  source_item_id: '1',
  status: 'pending',
  title: null,
  url: 'https://example.com/',
} as CrawlCandidate;

const resultInput = {
  candidateId: 1,
  canonicalUrl: 'https://example.com/',
  categoryName: 'writing',
  description: 'A factual summary of the product and its supported workflow.',
  detail:
    '### Overview\n\nDetailed publication content.\n\n### Features\n\nSupported features.\n\n### Usage\n\nSupported usage.',
  imageUrl: null,
  leaseToken: 'a'.repeat(43),
  title: 'Example',
};

describe('external crawler worker store', () => {
  it('claims jobs with a hashed, expiring lease', async () => {
    let leaseHash: unknown;
    const { store } = createStore((query, values) => {
      if (query.includes('select * from crawler.candidate')) return [candidate];
      if (query.includes('update crawler.candidate')) {
        [leaseHash] = values;
        return [{ ...candidate, attempt_count: 1, status: 'processing' }];
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const [claimed] = await store.claim(1);

    expect(claimed.leaseToken).toHaveLength(43);
    expect(leaseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(leaseHash).not.toBe(claimed.leaseToken);
  });

  it('rejects a result whose category is no longer active', async () => {
    const { store } = createStore((query) => {
      if (query.includes("status = 'processing'")) return [candidate];
      if (query.includes('select name from navigation_category')) return [];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(store.complete(resultInput)).rejects.toThrow('invalid_category');
  });

  it('rejects cross-site canonical and image URLs', async () => {
    const { store } = createStore((query) => {
      if (query.includes("status = 'processing'")) return [candidate];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(store.complete({ ...resultInput, canonicalUrl: 'https://attacker.example/' })).rejects.toThrow(
      'invalid_canonical_origin',
    );
    await expect(store.complete({ ...resultInput, imageUrl: 'https://tracker.example/pixel.png' })).rejects.toThrow(
      'invalid_image_origin',
    );
  });

  it('returns the existing publication for an idempotent result retry', async () => {
    const { store } = createStore((query) => {
      if (query.includes("status = 'processing'")) return [];
      if (query.includes("status = 'published'")) {
        return [{ canonical_url: candidate.canonical_url, category_name: 'writing' }];
      }
      if (query.includes('select name from web_navigation')) return [{ name: 'existing-tool' }];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(store.complete(resultInput)).resolves.toEqual({
      categoryName: 'writing',
      name: 'existing-tool',
      status: 'published',
    });
  });

  it('allows the www host variant and atomically publishes a live matching lease', async () => {
    const { store } = createStore((query) => {
      if (query.includes("status = 'processing'")) return [candidate];
      if (query.includes('select name from navigation_category')) return [{ name: 'writing' }];
      if (query.includes('insert into web_navigation')) return [{ name: 'example-com-1' }];
      if (query.includes('update crawler.candidate')) return [];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(store.complete({ ...resultInput, imageUrl: 'https://www.example.com/image.png' })).resolves.toEqual({
      categoryName: 'writing',
      name: 'example-com-1',
      status: 'published',
    });
  });
});
