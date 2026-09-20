export type DiscoveredCandidate = {
  source: 'github' | 'hacker_news' | 'submission';
  sourceItemId: string;
  sourceUrl: string | null;
  url: string;
};
