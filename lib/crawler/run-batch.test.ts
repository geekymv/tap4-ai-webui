import { describe, expect, it } from 'vitest';

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
});
