import { CrawlerStore, ReviewResult } from './store';

export type ReviewAction = 'approve' | 'reject';
export default async function reviewCandidate(
  store: CrawlerStore,
  candidateId: number,
  action: ReviewAction,
  categoryName?: string,
): Promise<ReviewResult> {
  return store.reviewCandidate(candidateId, action, categoryName);
}
