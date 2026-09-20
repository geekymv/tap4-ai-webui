import { Database } from '@/db/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import reviewCandidate from './review';

function clientWithRpc(
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  return { rpc } as unknown as SupabaseClient<Database>;
}

describe('reviewCandidate', () => {
  it('allows only one of two concurrent approvals to succeed', async () => {
    let status: 'review' | 'published' = 'review';
    const client = clientWithRpc(async () => {
      await Promise.resolve();
      if (status !== 'review') return { data: null, error: { message: 'candidate_not_reviewable' } };
      status = 'published';
      return { data: { name: 'example-1', status: 'published' }, error: null };
    });

    const results = await Promise.allSettled([
      reviewCandidate(client, 1, 'approve'),
      reviewCandidate(client, 1, 'approve'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('propagates transactional state update failures', async () => {
    const client = clientWithRpc(async () => ({ data: null, error: { message: 'submit update failed' } }));
    await expect(reviewCandidate(client, 1, 'reject')).rejects.toThrow('submit update failed');
  });
});
