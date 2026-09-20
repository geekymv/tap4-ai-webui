import { Database } from '@/db/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

export type ReviewAction = 'approve' | 'reject';
export type ReviewResult = {
  categoryName?: string;
  name?: string;
  status: 'published' | 'rejected';
};

export default async function reviewCandidate(
  client: SupabaseClient<Database>,
  candidateId: number,
  action: ReviewAction,
  categoryName?: string,
): Promise<ReviewResult> {
  const { data, error } = await client.rpc('review_crawl_candidate', {
    candidate_id: candidateId,
    category_override: categoryName || null,
    review_action: action,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('status' in data)) {
    throw new Error('Invalid review response');
  }
  return data as ReviewResult;
}
