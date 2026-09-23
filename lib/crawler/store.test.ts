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

describe('crawler review store category validation', () => {
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
