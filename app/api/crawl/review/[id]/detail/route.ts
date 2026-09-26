import { NextResponse } from 'next/server';

import { isReviewAdminAuthenticated } from '@/lib/admin/review-auth';
import createCrawlerStore from '@/lib/crawler/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(_: Request, { params: { id } }: { params: { id: string } }) {
  if (!isReviewAdminAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { headers: noStoreHeaders, status: 401 });
  }

  const candidateId = Number(id);
  if (!Number.isSafeInteger(candidateId) || candidateId < 1) {
    return NextResponse.json({ error: 'Invalid candidate id' }, { headers: noStoreHeaders, status: 400 });
  }

  try {
    const candidate = await createCrawlerStore().getReviewCandidateDetail(candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { headers: noStoreHeaders, status: 404 });
    }
    return NextResponse.json(candidate, { headers: noStoreHeaders });
  } catch (error) {
    console.error('Failed to load crawler candidate detail', error);
    return NextResponse.json({ error: 'Failed to load candidate detail' }, { headers: noStoreHeaders, status: 500 });
  }
}
