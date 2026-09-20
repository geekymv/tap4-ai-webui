import { CrawlCandidate, Database } from '@/db/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import processCandidate from './process';
import runBatchWithinBudget from './run-batch';

describe('runBatchWithinBudget', () => {
  it('uses controlled waves and does not claim work without enough time remaining', async () => {
    let now = 0;
    const claimed: number[] = [];
    const queue = [1, 2, 3, 4, 5];
    const results = await runBatchWithinBudget({
      claim: async (limit) => {
        claimed.push(limit);
        return queue.splice(0, limit);
      },
      concurrency: 2,
      deadline: 45000,
      maxItems: 5,
      minimumWindowMs: 16000,
      now: () => now,
      process: async (item) => {
        now += 10000;
        return item;
      },
    });

    expect(results).toEqual([1, 2, 3, 4]);
    expect(claimed).toEqual([2, 2]);
    expect(queue).toEqual([5]);
  });

  it('aborts in-flight work at the absolute deadline and lets it release claimed jobs', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const client = {
      from: () => ({
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            updates.push(values);
            return { error: null };
          },
        }),
      }),
    } as unknown as SupabaseClient<Database>;
    const candidate = {
      attempt_count: 1,
      id: 'candidate-1',
      status: 'processing',
      url: 'https://example.com',
    } as unknown as CrawlCandidate;
    const startedAt = Date.now();
    const results = await runBatchWithinBudget({
      claim: async () => [candidate],
      concurrency: 1,
      deadline: startedAt + 30,
      maxItems: 1,
      minimumWindowMs: 0,
      process: (item, signal) =>
        processCandidate(client, item, [], {
          deadline: startedAt + 30,
          signal,
          crawl: async (_url, options) =>
            new Promise((_, reject) => {
              options!.signal?.addEventListener('abort', () => reject(options!.signal?.reason), { once: true });
            }),
        }),
    });

    expect(results).toEqual([expect.objectContaining({ id: 'candidate-1', status: 'retry' })]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ locked_at: null, status: 'retry' });
    expect(Date.now() - startedAt).toBeLessThan(250);
  });
});
