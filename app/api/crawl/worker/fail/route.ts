import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import verifyWorkerAuthorization from '@/lib/crawler/worker-auth';
import { workerFailureSchema } from '@/lib/crawler/worker-contract';
import createCrawlerWorkerStore from '@/lib/crawler/worker-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!verifyWorkerAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const input = workerFailureSchema.parse(await req.json());
    return NextResponse.json(await createCrawlerWorkerStore().fail(input.candidateId, input.leaseToken, input.message));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker failure report failed';
    let status = 500;
    if (error instanceof ZodError || error instanceof SyntaxError) status = 400;
    if (message.includes('invalid_or_expired_lease')) status = 409;
    return NextResponse.json({ error: message }, { status });
  }
}
