import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import { verifyReviewAuthorization } from '@/lib/admin/review-auth';
import reviewCandidate, { ReviewAction } from '@/lib/crawler/review';
import createCrawlerStore from '@/lib/crawler/store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params: { id } }: { params: { id: string } }) {
  if (!verifyReviewAuthorization(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action?: ReviewAction; categoryName?: string };
    if (!body.action || !['approve', 'reject', 'rewrite'].includes(body.action)) {
      return NextResponse.json({ error: 'action must be approve, reject, or rewrite' }, { status: 400 });
    }
    const candidateId = Number(id);
    if (!Number.isSafeInteger(candidateId) || candidateId < 1) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 });
    }

    const result = await reviewCandidate(createCrawlerStore(), candidateId, body.action, body.categoryName);
    if (result.status === 'published') {
      revalidatePath('/');
      revalidatePath('/explore');
      revalidatePath(`/category/${result.categoryName}`);
      revalidatePath(`/ai/${result.name}`);
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed';
    let status = 500;
    if (message.includes('candidate_not_reviewable')) status = 409;
    if (message.includes('invalid_category')) status = 400;
    return NextResponse.json({ error: message }, { status });
  }
}
