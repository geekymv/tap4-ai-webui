import { NextRequest, NextResponse } from 'next/server';

import processCandidate from '@/lib/crawler/process';
import runBatchWithinBudget from '@/lib/crawler/run-batch';
import createCrawlerStore from '@/lib/crawler/store';
import authorizeCron from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

async function processQueue(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  try {
    const startedAt = Date.now();
    const store = createCrawlerStore();
    const categories = await store.listCategories();

    const maxItems = Math.min(Math.max(Number(process.env.CRAWL_BATCH_SIZE) || 6, 1), 20);
    const concurrency = Math.min(Math.max(Number(process.env.CRAWL_CONCURRENCY) || 2, 1), 4);
    const processed = await runBatchWithinBudget({
      claim: (limit) => store.claimCandidates(limit),
      concurrency,
      // Stop network work at 42s, leaving 18s before Vercel termination to release claimed rows.
      deadline: startedAt + 42000,
      maxItems,
      minimumWindowMs: 16000,
      process: (candidate, signal) =>
        processCandidate(store, candidate, categories, { deadline: startedAt + 42000, signal }),
    });
    return NextResponse.json({ elapsedMs: Date.now() - startedAt, processed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown processing error' },
      { status: 500 },
    );
  }
}

export const GET = processQueue;
export const POST = processQueue;
