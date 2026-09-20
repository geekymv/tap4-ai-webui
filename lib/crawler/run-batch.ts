export type BatchRunnerOptions<T, R> = {
  claim: (limit: number) => Promise<T[]>;
  concurrency: number;
  deadline: number;
  maxItems: number;
  minimumWindowMs: number;
  now?: () => number;
  process: (item: T) => Promise<R>;
};

export default async function runBatchWithinBudget<T, R>({
  claim,
  concurrency,
  deadline,
  maxItems,
  minimumWindowMs,
  now = Date.now,
  process,
}: BatchRunnerOptions<T, R>) {
  const results: R[] = [];
  while (results.length < maxItems && now() + minimumWindowMs <= deadline) {
    const limit = Math.min(concurrency, maxItems - results.length);
    // Claim only the wave that can start immediately, so no job is left locked when the budget expires.
    // eslint-disable-next-line no-await-in-loop
    const items = await claim(limit);
    if (!items.length) break;
    // eslint-disable-next-line no-await-in-loop
    results.push(...(await Promise.all(items.map(process))));
  }
  return results;
}
