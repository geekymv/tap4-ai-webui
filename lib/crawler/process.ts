import classifyWebsite from './classify';
import crawlWebsite, { CrawlDeadline } from './fetch-page';
import { CrawlCandidate, CrawlerStore } from './store';

type ProcessOptions = CrawlDeadline & { crawl?: typeof crawlWebsite };

export default async function processCandidate(
  store: CrawlerStore,
  candidate: CrawlCandidate,
  categories: Array<{ name: string; title: string | null }>,
  options: ProcessOptions,
) {
  try {
    const website = await (options.crawl || crawlWebsite)(candidate.url, options);
    const categoryName = classifyWebsite(website.title, website.description, categories);
    await store.markCandidateReview(candidate.id, {
      canonicalUrl: website.canonicalUrl,
      categoryName,
      description: website.description,
      detail: website.detail,
      imageUrl: website.imageUrl,
      title: website.title,
    });
    return { id: candidate.id, status: 'review' as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown crawler error';
    const status = await store.markCandidateFailed(candidate, message);
    return { error: message, id: candidate.id, status };
  }
}
