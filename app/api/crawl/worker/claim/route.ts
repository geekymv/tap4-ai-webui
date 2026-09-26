import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import verifyWorkerAuthorization from '@/lib/crawler/worker-auth';
import { workerClaimSchema } from '@/lib/crawler/worker-contract';
import createCrawlerWorkerStore from '@/lib/crawler/worker-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function serializedCandidateId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('invalid_candidate_id');
  return id;
}

export async function POST(req: NextRequest) {
  if (!verifyWorkerAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rawBody = await req.text();
    const body = workerClaimSchema.parse(rawBody ? JSON.parse(rawBody) : {});
    const store = createCrawlerWorkerStore();
    const categories = await store.listCategories();
    const candidates = await store.claim(body.limit);
    return NextResponse.json({
      candidates: candidates.map((candidate) => ({
        attemptCount: candidate.attempt_count,
        id: serializedCandidateId(candidate.id),
        leaseToken: candidate.leaseToken,
        url: candidate.url,
      })),
      categories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker claim failed';
    const status = error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
