import { NextRequest, NextResponse } from 'next/server';
import createServerClient from '@/db/supabase/server';

import processCandidate from '@/lib/crawler/process';
import runBatchWithinBudget from '@/lib/crawler/run-batch';
import authorizeCron from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

async function processQueue(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  try {
    const startedAt = Date.now();
    const supabase = createServerClient();
    const { data: categories, error: categoryError } = await supabase
      .from('navigation_category')
      .select('name,title')
      .eq('del_flag', 0);
    if (categoryError) throw new Error(categoryError.message);

    const maxItems = Math.min(Math.max(Number(process.env.CRAWL_BATCH_SIZE) || 6, 1), 20);
    const concurrency = Math.min(Math.max(Number(process.env.CRAWL_CONCURRENCY) || 2, 1), 4);
    const processed = await runBatchWithinBudget({
      claim: async (limit) => {
        const { data, error } = await supabase.rpc('claim_crawl_candidates', { batch_size: limit });
        if (error) throw new Error(error.message);
        return data || [];
      },
      concurrency,
      deadline: startedAt + 45000,
      maxItems,
      minimumWindowMs: 16000,
      process: (candidate) => processCandidate(supabase, candidate, categories || []),
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
