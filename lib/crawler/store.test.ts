import { Sql } from 'postgres';
import { describe, expect, it, vi } from 'vitest';

import createCrawlerStore, { CrawlCandidate } from './store-factory';

function storeWithMissingFinalCategory(candidateCategory: string | null) {
  const candidate = {
    attempt_count: 1,
    canonical_url: 'https://example.com/',
    category_name: candidateCategory,
    description: 'A complete description.',
    detail: '## Complete detail',
    domain: 'example.com',
    id: 1,
    image_url: null,
    source: 'github',
    source_item_id: '1',
    status: 'review',
    title: 'Example',
    url: 'https://example.com/',
  } as CrawlCandidate;
  const transaction = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');
    if (query.includes('select * from crawler.candidate')) return Promise.resolve([candidate]);
    if (query.includes('select name from navigation_category')) return Promise.resolve([]);
    throw new Error(`Unexpected query: ${query}`);
  });
  const sql = {
    begin: async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as unknown as Sql;
  return { store: createCrawlerStore(sql), transaction };
}

describe('crawler review store queries', () => {
  it('keeps large candidate detail content out of the paginated review query', async () => {
    const queries: string[] = [];
    const sql = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join(' ');
      queries.push(query);
      if (query.includes('count(*)')) return Promise.resolve([{ count: 0 }]);
      return Promise.resolve([]);
    }) as unknown as Sql;

    await createCrawlerStore(sql).listReviewCandidates(0, 12);

    const listQuery = queries.find((query) => query.includes('order by updated_at'));
    expect(listQuery).toBeDefined();
    expect(listQuery).not.toContain('select *');
    expect(listQuery).toContain('detail is not null as has_detail');
  });
});

describe('crawler review store category validation', () => {
  it('atomically requeues a review candidate for rewriting', async () => {
    const candidate = {
      attempt_count: 2,
      canonical_url: 'https://example.com/',
      category_name: 'writing',
      description: 'Existing description.',
      detail: '### Existing detail',
      domain: 'example.com',
      id: 1,
      image_url: null,
      source: 'github',
      source_item_id: null,
      status: 'review',
      title: 'Example',
      url: 'https://example.com/',
    } as CrawlCandidate;
    let requeueQuery = '';
    const transaction = vi.fn((strings: TemplateStringsArray) => {
      const query = strings.join(' ');
      if (query.includes('select * from crawler.candidate')) return Promise.resolve([candidate]);
      if (query.includes("set status = 'pending'")) {
        requeueQuery = query;
        return Promise.resolve([]);
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const sql = {
      begin: async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction),
    } as unknown as Sql;

    await expect(createCrawlerStore(sql).reviewCandidate(1, 'rewrite')).resolves.toEqual({ status: 'pending' });
    expect(requeueQuery).toContain('attempt_count = 0');
    expect(requeueQuery).toContain('worker_lease_hash = null');
  });

  it('rejects a stale automatic category before publishing', async () => {
    const { store, transaction } = storeWithMissingFinalCategory('removed-category');

    await expect(store.reviewCandidate(1, 'approve')).rejects.toThrow('invalid_category');
    expect(transaction.mock.calls.some(([query]) => String.raw(query).includes('insert into web_navigation'))).toBe(
      false,
    );
  });

  it('rejects the other fallback when that category does not exist', async () => {
    const { store } = storeWithMissingFinalCategory(null);

    await expect(store.reviewCandidate(1, 'approve')).rejects.toThrow('invalid_category');
  });
});
