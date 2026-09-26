import { z } from 'zod';

import processCandidate from '../lib/crawler/process';
import type { CandidateReview, CrawlCandidate, CrawlerStore } from '../lib/crawler/store-factory';
import { haveSameHttpHost } from '../lib/crawler/worker-contract';

const claimResponseSchema = z.object({
  candidates: z.array(
    z.object({
      attemptCount: z.number().int().positive(),
      id: z.coerce.number().int().positive().safe(),
      leaseToken: z.string().min(32),
      url: z.string().url(),
    }),
  ),
  categories: z.array(z.object({ name: z.string(), title: z.string().nullable() })),
});

const siteUrl = process.env.GETAITOOLS_SITE_URL;
const workerKey = process.env.GETAITOOLS_CRAWLER_WORKER_KEY;
if (!siteUrl || !workerKey) {
  throw new Error('GETAITOOLS_SITE_URL and GETAITOOLS_CRAWLER_WORKER_KEY are required');
}
const origin = new URL(siteUrl);
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
  throw new Error('GETAITOOLS_SITE_URL must use HTTPS');
}
const batchSize = Math.min(Math.max(Number(process.env.CRAWLER_WORKER_BATCH_SIZE) || 5, 1), 5);
const jobTimeoutMs = Math.min(Math.max(Number(process.env.CRAWLER_WORKER_JOB_TIMEOUT_MS) || 90000, 15000), 300000);

async function apiRequest(path: string, body: unknown) {
  const response = await fetch(new URL(path, origin), {
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${workerKey}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Worker API ${path} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

async function main() {
  const claimed = claimResponseSchema.parse(await apiRequest('/api/crawl/worker/claim', { limit: batchSize }));
  const results: unknown[] = [];
  for (let index = 0; index < claimed.candidates.length; index += 1) {
    const job = claimed.candidates[index];
    const candidate = {
      attempt_count: job.attemptCount,
      id: job.id,
      status: 'processing',
      url: job.url,
    } as CrawlCandidate;
    const store = {
      markCandidateFailed: async (_candidate: CrawlCandidate, message: string) => {
        const result = z.object({ status: z.enum(['retry', 'failed']) }).parse(
          await apiRequest('/api/crawl/worker/fail', {
            candidateId: job.id,
            leaseToken: job.leaseToken,
            message,
          }),
        );
        return result.status;
      },
      markCandidateReview: async (_id: number, review: CandidateReview) => {
        const imageUrl =
          review.imageUrl && haveSameHttpHost(review.canonicalUrl, review.imageUrl) ? review.imageUrl : null;
        await apiRequest('/api/crawl/worker/result', {
          ...review,
          candidateId: job.id,
          imageUrl,
          leaseToken: job.leaseToken,
        });
      },
    } as CrawlerStore;
    const controller = new AbortController();
    const deadline = Date.now() + jobTimeoutMs;
    const timer = setTimeout(() => controller.abort(new Error('External crawler job deadline exceeded')), jobTimeoutMs);
    try {
      // Jobs are intentionally sequential to keep outbound load and LLM cost bounded.
      results.push(
        // eslint-disable-next-line no-await-in-loop
        await processCandidate(store, candidate, claimed.categories, { deadline, signal: controller.signal }),
      );
    } finally {
      clearTimeout(timer);
    }
  }
  process.stdout.write(`${JSON.stringify({ claimed: claimed.candidates.length, results })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'External crawler worker failed'}\n`);
  process.exitCode = 1;
});
