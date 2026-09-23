import { describe, expect, it } from 'vitest';

import { LlmEnrichmentTimeoutError } from './enrich';
import processCandidate from './process';
import { CandidateReview, CrawlCandidate, CrawlerStore } from './store';

const candidate = {
  attempt_count: 1,
  id: 7,
  status: 'processing',
  url: 'https://example.com',
} as CrawlCandidate;
const website = {
  canonicalUrl: 'https://example.com/',
  description: 'Original extracted description for an AI writing product.',
  detail: '## Original\n\nOriginal extracted page content that is sufficiently detailed for the crawler fallback path.',
  imageUrl: null,
  title: 'Example Writer',
};

describe('processCandidate LLM enrichment', () => {
  it('stores enriched content before moving the candidate to review', async () => {
    let saved: CandidateReview | undefined;
    const store = {
      markCandidateReview: async (_id: number, review: CandidateReview) => {
        saved = review;
      },
    } as CrawlerStore;

    const result = await processCandidate(store, candidate, [{ name: 'writing', title: 'AI Writing' }], {
      crawl: async () => website,
      deadline: Date.now() + 1000,
      enrich: async () => ({
        categoryName: 'writing',
        description: 'A richer factual description of the writing product.',
        detail:
          '## Overview\n\nA richer factual profile.\n\n## Key Features\n\n- Drafting\n- Editing\n- Team workflows',
      }),
    });

    expect(result).toMatchObject({ enrichment: 'enhanced', status: 'review' });
    expect(saved).toMatchObject({
      categoryName: 'writing',
      description: 'A richer factual description of the writing product.',
    });
  });

  it('falls back to extracted content when the provider fails before the batch deadline', async () => {
    let saved: CandidateReview | undefined;
    const store = {
      markCandidateReview: async (_id: number, review: CandidateReview) => {
        saved = review;
      },
    } as CrawlerStore;

    const result = await processCandidate(store, candidate, [], {
      crawl: async () => website,
      deadline: Date.now() + 1000,
      enrich: async () => {
        throw new Error('provider unavailable');
      },
    });

    expect(result).toMatchObject({ enrichment: 'fallback', enrichmentError: 'provider unavailable', status: 'review' });
    expect(saved).toMatchObject({ description: website.description, detail: website.detail });
  });

  it('falls back when the LLM times out inside its persistence reserve', async () => {
    let saved: CandidateReview | undefined;
    const store = {
      markCandidateReview: async (_id: number, review: CandidateReview) => {
        saved = review;
      },
    } as CrawlerStore;

    const result = await processCandidate(store, candidate, [], {
      crawl: async () => website,
      deadline: Date.now() + 1000,
      enrich: async () => {
        throw new LlmEnrichmentTimeoutError();
      },
    });

    expect(result).toMatchObject({ enrichment: 'fallback', status: 'review' });
    expect(saved).toMatchObject({ description: website.description, detail: website.detail });
  });
});
