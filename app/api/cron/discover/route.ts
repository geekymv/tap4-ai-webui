import { NextRequest, NextResponse } from 'next/server';
import createServerClient from '@/db/supabase/server';

import authorizeCron from '@/lib/cron/auth';
import runDiscovery from '@/lib/discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export const runtime = 'nodejs';

async function discover(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await runDiscovery(createServerClient()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown discovery error' },
      { status: 500 },
    );
  }
}

export const GET = discover;
export const POST = discover;
