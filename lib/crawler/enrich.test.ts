import { describe, expect, it, vi } from 'vitest';

import enrichWebsite, { LlmEnrichmentTimeoutError } from './enrich';
import { ExtractedWebsite } from './extract';

const website: ExtractedWebsite = {
  canonicalUrl: 'https://example.com/',
  description: 'An AI writing assistant for product teams.',
  detail: 'Example helps product teams draft release notes, documentation, and launch copy from structured briefs.',
  imageUrl: null,
  title: 'Example AI Writer',
};
const categories = [
  { name: 'writing', title: 'AI Writing' },
  { name: 'video', title: 'AI Video' },
];
const env = {
  CRAWLER_LLM_API_KEY: 'secret-key',
  CRAWLER_LLM_ENABLED: 'true',
  CRAWLER_LLM_MODEL: 'test-model',
  CRAWLER_LLM_WRITE_RESERVE_MS: '100',
};

function providerResponse(content: Record<string, unknown>) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

describe('crawler LLM enrichment', () => {
  it('returns validated rich content and a confident allowlisted category', async () => {
    let capturedInit: RequestInit | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return providerResponse({
        categoryConfidence: 0.92,
        categoryName: 'writing',
        description:
          'Example is an AI writing assistant that helps product teams turn structured briefs into launch content.',
        detail:
          '## Overview\n\nExample helps product teams prepare written launch material from structured briefs while keeping the supplied product facts central to each draft.\n\n## Key Features\n\n- Drafts release notes from briefs\n- Produces product documentation\n- Creates launch copy for product teams\n\n## Use Cases\n\nTeams can prepare consistent release communication and documentation.',
      });
    });

    const result = await enrichWebsite(website, categories, {
      deadline: Date.now() + 1000,
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(result).toMatchObject({ categoryName: 'writing' });
    expect(result?.detail).toContain('## Key Features');
    const body = JSON.parse(String(capturedInit?.body));
    expect(body.model).toBe('test-model');
    expect(body.messages[0].content).toContain('untrusted source material');
  });

  it('drops a category that is unknown or below the confidence threshold', async () => {
    const fetcher = vi.fn(async () =>
      providerResponse({
        categoryConfidence: 0.99,
        categoryName: 'internal-only',
        description: 'Example is an AI writing assistant that prepares launch content from supplied product briefs.',
        detail:
          '## Overview\n\nExample prepares launch content from structured product briefs and keeps the generated material focused on the facts supplied by product teams.\n\n## Supported Uses\n\nIt can draft release notes, product documentation, and launch copy for product teams that need consistent written communication.\n\n## Workflow\n\nTeams provide a brief and use the resulting draft in their existing review process.',
      }),
    );

    await expect(
      enrichWebsite(website, categories, {
        deadline: Date.now() + 1000,
        env,
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toMatchObject({ categoryName: null });
  });

  it.each([
    ['reference image', '![Tracking pixel][pixel]\n\n[pixel]: https://tracker.example/pixel.png'],
    ['reference link', '[Read more][target]\n\n[target]: https://malicious.example'],
  ])('rejects %s syntax in generated Markdown', async (_name, unsafeMarkdown) => {
    const fetcher = vi.fn(async () =>
      providerResponse({
        categoryConfidence: 0.9,
        categoryName: 'writing',
        description: 'Example is an AI writing assistant that prepares launch content from supplied product briefs.',
        detail: `## Overview\n\n${'Factual product information. '.repeat(8)}\n\n${unsafeMarkdown}`,
      }),
    );

    await expect(
      enrichWebsite(website, categories, {
        deadline: Date.now() + 1000,
        env,
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toThrow('Detail must not contain links, images, or HTML');
  });

  it('uses a provider timeout before the hard deadline to reserve persistence time', async () => {
    const startedAt = Date.now();
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    );

    await expect(
      enrichWebsite(website, categories, {
        deadline: startedAt + 300,
        env: { ...env, CRAWLER_LLM_TIMEOUT_MS: '50' },
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(LlmEnrichmentTimeoutError);
    expect(Date.now() - startedAt).toBeLessThan(200);
  });

  it('does not convert a parent hard-deadline abort into a provider timeout', async () => {
    const controller = new AbortController();
    const hardDeadlineError = new Error('Crawler batch deadline exceeded');
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    );
    setTimeout(() => controller.abort(hardDeadlineError), 10);

    await expect(
      enrichWebsite(website, categories, {
        deadline: Date.now() + 300,
        env: { ...env, CRAWLER_LLM_TIMEOUT_MS: '100' },
        fetcher: fetcher as typeof fetch,
        signal: controller.signal,
      }),
    ).rejects.toBe(hardDeadlineError);
  });

  it('skips the provider when only the persistence reserve remains', async () => {
    const fetcher = vi.fn();

    await expect(
      enrichWebsite(website, categories, {
        deadline: Date.now() + 50,
        env,
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(LlmEnrichmentTimeoutError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not call a provider when enrichment is disabled', async () => {
    const fetcher = vi.fn();

    await expect(
      enrichWebsite(website, categories, {
        deadline: Date.now() + 1000,
        env: { ...env, CRAWLER_LLM_ENABLED: 'false' },
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
