import { getDomain, normalizeUrl } from '@/lib/crawler/normalize';
import { CrawlerStore } from '@/lib/crawler/store';

import discoverFromGitHub from './github';
import discoverFromHackerNews from './hacker-news';
import { DiscoveredCandidate } from './types';

async function discoverFromSubmissions(store: CrawlerStore): Promise<DiscoveredCandidate[]> {
  const data = await store.listPendingSubmissions();
  return data
    .filter((item): item is typeof item & { url: string } => Boolean(item.url))
    .map((item) => ({
      source: 'submission',
      sourceItemId: String(item.id),
      sourceUrl: null,
      url: item.url,
    }));
}

export default async function runDiscovery(store: CrawlerStore) {
  const settled = await Promise.allSettled([
    discoverFromSubmissions(store),
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
    await store.upsertCandidates(rows);
  }
  return { discovered: rows.length, errors };
}
