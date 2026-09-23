import classifyWebsite from './classify';
import enrichWebsite from './enrich';
import crawlWebsite, { CrawlDeadline } from './fetch-page';
import { CrawlCandidate, CrawlerStore } from './store';

type ProcessOptions = CrawlDeadline & { crawl?: typeof crawlWebsite; enrich?: typeof enrichWebsite };

export default async function processCandidate(
  store: CrawlerStore,
  candidate: CrawlCandidate,
  categories: Array<{ name: string; title: string | null }>,
  options: ProcessOptions,
) {
  try {
    const website = await (options.crawl || crawlWebsite)(candidate.url, options);
    let categoryName = classifyWebsite(website.title, website.description, categories);
    let { description, detail } = website;
    let enrichment: 'disabled' | 'enhanced' | 'fallback' = 'disabled';
    let enrichmentError: string | undefined;
    try {
      const enriched = await (options.enrich || enrichWebsite)(website, categories, options);
      if (enriched) {
        categoryName = enriched.categoryName || categoryName;
        description = enriched.description;
        detail = enriched.detail;
        enrichment = 'enhanced';
      }
    } catch (error) {
      if (options.signal?.aborted || Date.now() >= options.deadline) throw error;
      enrichment = 'fallback';
      enrichmentError = error instanceof Error ? error.message.slice(0, 300) : 'Unknown LLM enrichment error';
    }
    await store.markCandidateReview(candidate.id, {
      canonicalUrl: website.canonicalUrl,
      categoryName,
      description,
      detail,
      imageUrl: website.imageUrl,
      title: website.title,
    });
    return { enrichment, enrichmentError, id: candidate.id, status: 'review' as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown crawler error';
    const status = await store.markCandidateFailed(candidate, message);
    return { error: message, id: candidate.id, status };
  }
}
