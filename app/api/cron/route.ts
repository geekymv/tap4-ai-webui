import { NextRequest, NextResponse } from 'next/server';
import createServerClient from '@/db/supabase/server';

import processCandidate from '@/lib/crawler/process';
import runDiscovery from '@/lib/discovery';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function runCron(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronKey = process.env.CRON_SECRET || process.env.CRON_AUTH_KEY;
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createServerClient();
    const discovery = await runDiscovery(supabase);
    const batchSize = Math.min(Math.max(Number(process.env.CRAWL_BATCH_SIZE) || 5, 1), 20);
    const [{ data: candidates, error: claimError }, { data: categories, error: categoryError }] = await Promise.all([
      supabase.rpc('claim_crawl_candidates', { batch_size: batchSize }),
      supabase.from('navigation_category').select('name,title').eq('del_flag', 0),
    ]);
    if (claimError) throw new Error(claimError.message);
    if (categoryError) throw new Error(categoryError.message);

    const processed = [];
    for (const candidate of candidates || []) {
      processed.push(await processCandidate(supabase, candidate, categories || []));
    }
    return NextResponse.json({ discovery, processed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown cron error' }, { status: 500 });
  }
}

export const GET = runCron;
export const POST = runCron;
