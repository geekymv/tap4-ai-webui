import { CrawlerStore, ReviewResult } from './store';

export type ReviewAction = 'approve' | 'reject' | 'rewrite';
export default async function reviewCandidate(
  store: CrawlerStore,
  candidateId: number,
  action: ReviewAction,
  categoryName?: string,
): Promise<ReviewResult> {
  if (action === 'approve' && categoryName) {
    const categories = await store.listCategories();
    if (!categories.some((category) => category.name === categoryName)) {
      throw new Error('invalid_category');
    }
  }
  return store.reviewCandidate(candidateId, action, categoryName);
}
