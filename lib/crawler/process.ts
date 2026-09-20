import { CrawlCandidate, Database } from '@/db/supabase/types';
import { SupabaseClient } from '@supabase/supabase-js';

import classifyWebsite from './classify';
import crawlWebsite from './fetch-page';

export default async function processCandidate(
  client: SupabaseClient<Database>,
  candidate: CrawlCandidate,
  categories: Array<{ name: string; title: string | null }>,
) {
  try {
    const website = await crawlWebsite(candidate.url);
    const categoryName = classifyWebsite(website.title, website.description, categories);
    const { error } = await client
      .from('crawl_candidate')
      .update({
        canonical_url: website.canonicalUrl,
        category_name: categoryName,
        description: website.description,
        detail: website.detail,
        error_message: null,
        image_url: website.imageUrl,
        locked_at: null,
        next_retry_at: null,
        status: 'review',
        title: website.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id);
    if (error) throw new Error(error.message);
    return { id: candidate.id, status: 'review' as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown crawler error';
    const retry = candidate.attempt_count < 3;
    const nextRetryAt = retry
      ? new Date(Date.now() + 2 ** candidate.attempt_count * 15 * 60 * 1000).toISOString()
      : null;
    await client
      .from('crawl_candidate')
      .update({
        error_message: message,
        locked_at: null,
        next_retry_at: nextRetryAt,
        status: retry ? 'retry' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id);
    return { error: message, id: candidate.id, status: retry ? ('retry' as const) : ('failed' as const) };
  }
}
