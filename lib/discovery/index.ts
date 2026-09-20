import { Database } from '@/db/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

import { getDomain, normalizeUrl } from '@/lib/crawler/normalize';

import discoverFromGitHub from './github';
import discoverFromHackerNews from './hacker-news';
import { DiscoveredCandidate } from './types';

async function discoverFromSubmissions(client: SupabaseClient<Database>): Promise<DiscoveredCandidate[]> {
  const { data, error } = await client
    .from('submit')
    .select('id,url')
    .eq('status', 0)
    .order('is_feature', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((item): item is typeof item & { url: string } => Boolean(item.url))
    .map((item) => ({
      source: 'submission',
      sourceItemId: String(item.id),
      sourceUrl: null,
      url: item.url,
    }));
}

export default async function runDiscovery(client: SupabaseClient<Database>) {
  const settled = await Promise.allSettled([
    discoverFromSubmissions(client),
    discoverFromHackerNews(),
    discoverFromGitHub(),
  ]);
  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));
  const candidates = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  const rows = candidates.flatMap((candidate) => {
    try {
      const canonicalUrl = normalizeUrl(candidate.url);
      return [
        {
          canonical_url: canonicalUrl,
          domain: getDomain(canonicalUrl),
          source: candidate.source,
          source_item_id: candidate.sourceItemId,
          source_url: candidate.sourceUrl,
          url: candidate.url,
        },
      ];
    } catch {
      return [];
    }
  });
  if (rows.length) {
    const { error } = await client.from('crawl_candidate').upsert(rows, {
      ignoreDuplicates: true,
      onConflict: 'canonical_url',
    });
    if (error) throw new Error(error.message);
  }
  return { discovered: rows.length, errors };
}
