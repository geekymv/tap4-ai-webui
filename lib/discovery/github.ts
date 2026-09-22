import { DiscoveredCandidate } from './types';

type GitHubSearchResponse = { items?: Array<{ homepage?: string | null; html_url: string; id: number }> };

export default async function discoverFromGitHub(): Promise<DiscoveredCandidate[]> {
  const topics = (process.env.DISCOVERY_GITHUB_TOPICS || 'ai,llm,generative-ai')
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 3);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GetAIToolsBot/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const results = await Promise.all(
    topics.map(async (topic) => {
      const query = encodeURIComponent(`topic:${topic} pushed:>=${since}`);
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${query}&sort=updated&order=desc&per_page=10`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw new Error(`GitHub discovery returned HTTP ${response.status}`);
      return (await response.json()) as GitHubSearchResponse;
    }),
  );
  const candidates = results.flatMap((result) =>
    (result.items || [])
      .filter((item) => item.homepage)
      .map((item) => ({
        source: 'github' as const,
        sourceItemId: String(item.id),
        sourceUrl: item.html_url,
        url: item.homepage!,
      })),
  );
  return Array.from(new Map(candidates.map((candidate) => [candidate.sourceItemId, candidate])).values());
}
