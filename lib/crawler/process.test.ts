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
const richDetail = `### Overview

Example Writer helps product teams turn structured briefs into release notes, documentation, and launch copy. The workspace keeps source facts visible while users prepare and revise each draft for publication.

The product is designed for teams that need repeatable written communication across releases. Users remain responsible for reviewing the generated wording and adapting it to their audience.

### Key Features

- Drafts release notes from structured product briefs
- Prepares documentation based on supplied product information
- Produces launch copy for product teams
- Keeps drafting and revision work in one focused workspace

These capabilities support a consistent workflow without changing the factual scope of the source material. Teams can refine drafts before moving them into their normal publishing process.

### How to Use

Teams begin by providing a structured brief containing the product facts that should appear in the output. They select the required content type, generate a draft, and review the result inside the workspace.

After generation, editors revise tone and wording, verify important claims against the brief, and prepare the approved copy for publication. This review step keeps the final communication aligned with the supplied information.`;

function publishingStore(onPublish?: (review: CandidateReview) => void) {
  return {
    markCandidateFailed: async () => 'retry' as const,
    publishCandidate: async (_id: number, review: CandidateReview) => {
      onPublish?.(review);
      return { categoryName: review.categoryName || 'other', name: 'example-com-7', status: 'published' as const };
    },
  } as unknown as CrawlerStore;
}

describe('processCandidate LLM enrichment', () => {
  it('publishes validated enriched content without a review queue step', async () => {
    let saved: CandidateReview | undefined;
    const result = await processCandidate(
      publishingStore((review) => {
        saved = review;
      }),
      candidate,
      [{ name: 'writing', title: 'AI Writing' }],
      {
        crawl: async () => website,
        deadline: Date.now() + 1000,
        enrich: async () => ({
          categoryName: 'writing',
          description: 'A richer factual description of the writing product and its supported team workflow.',
          detail: richDetail,
        }),
      },
    );

    expect(result).toMatchObject({ enrichment: 'enhanced', status: 'published' });
    expect(saved).toMatchObject({
      categoryName: 'writing',
      description: 'A richer factual description of the writing product and its supported team workflow.',
    });
  });

  it('rejects extracted fallback content that is not safe to publish automatically', async () => {
    let published = false;
    const store = {
      markCandidateFailed: async () => 'retry' as const,
      publishCandidate: async () => {
        published = true;
        return { categoryName: 'other', name: 'example-com-7', status: 'published' as const };
      },
    } as unknown as CrawlerStore;

    const result = await processCandidate(store, candidate, [], {
      crawl: async () => website,
      deadline: Date.now() + 1000,
      enrich: async () => {
        throw new Error('provider unavailable');
      },
    });

    expect(result.status).toBe('retry');
    expect(published).toBe(false);
  });

  it('does not publish invalid fallback content after an LLM timeout', async () => {
    let published = false;
    const store = {
      markCandidateFailed: async () => 'retry' as const,
      publishCandidate: async () => {
        published = true;
        return { categoryName: 'other', name: 'example-com-7', status: 'published' as const };
      },
    } as unknown as CrawlerStore;

    const result = await processCandidate(store, candidate, [], {
      crawl: async () => website,
      deadline: Date.now() + 1000,
      enrich: async () => {
        throw new LlmEnrichmentTimeoutError();
      },
    });

    expect(result.status).toBe('retry');
    expect(published).toBe(false);
  });
});
