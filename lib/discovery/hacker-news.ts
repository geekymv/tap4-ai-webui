import { DiscoveredCandidate } from './types';

type HackerNewsItem = { id: number; text?: string; title?: string; url?: string };
const AI_TERMS = /\b(ai|artificial intelligence|llm|gpt|machine learning|image generator|video generator|agent)\b/i;

export default async function discoverFromHackerNews(): Promise<DiscoveredCandidate[]> {
  const idsResponse = await fetch('https://hacker-news.firebaseio.com/v0/showstories.json', {
    signal: AbortSignal.timeout(10000),
  });
  if (!idsResponse.ok) throw new Error(`Hacker News returned HTTP ${idsResponse.status}`);
  const ids = ((await idsResponse.json()) as number[]).slice(0, 40);
  const items = await Promise.all(
    ids.map(async (id) => {
      const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        signal: AbortSignal.timeout(10000),
      });
      return response.ok ? ((await response.json()) as HackerNewsItem) : null;
    }),
  );
  return items
    .filter((item): item is HackerNewsItem => Boolean(item?.url && AI_TERMS.test(`${item.title} ${item.text || ''}`)))
    .map((item) => ({
      source: 'hacker_news',
      sourceItemId: String(item.id),
      sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`,
      url: item.url!,
    }));
}
