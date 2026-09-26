import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { agentJobSchema, buildWorkerResult, getAgentRunPaths, parseAgentOutput } from '../lib/crawler/agent-worker';
import { makeEditorialGuidance } from '../lib/crawler/editorial-guidance';
import type { ExtractedWebsite } from '../lib/crawler/extract';
import crawlWebsite from '../lib/crawler/fetch-page';

const claimResponseSchema = z.object({
  candidates: z.array(
    z.object({
      attemptCount: z.number().int().positive(),
      id: z.coerce.number().int().positive().safe(),
      leaseToken: z.string().min(32),
      url: z.string().url(),
    }),
  ),
  categories: z.array(z.object({ name: z.string().min(1).max(100), title: z.string().nullable() })),
});

const stateSchema = z.object({
  categories: z.array(z.object({ name: z.string().min(1).max(100), title: z.string().nullable() })),
  jobs: z.array(
    z.object({
      candidateId: z.number().int().positive(),
      leaseToken: z.string().min(32),
      website: z.object({
        canonicalUrl: z.string(),
        description: z.string(),
        detail: z.string(),
        imageUrl: z.string().nullable(),
        title: z.string(),
      }),
    }),
  ),
});

type State = z.infer<typeof stateSchema>;

const siteUrl = process.env.GETAITOOLS_SITE_URL;
const workerKey = process.env.GETAITOOLS_CRAWLER_WORKER_KEY;
if (!siteUrl || !workerKey) {
  throw new Error('GETAITOOLS_SITE_URL and GETAITOOLS_CRAWLER_WORKER_KEY are required');
}
const configuredWorkerKey = workerKey;
const origin = new URL(siteUrl);
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
  throw new Error('GETAITOOLS_SITE_URL must use HTTPS');
}

const batchSize = Math.min(Math.max(Number(process.env.CRAWLER_WORKER_BATCH_SIZE) || 3, 1), 3);
const jobTimeoutMs = Math.min(Math.max(Number(process.env.CRAWLER_WORKER_JOB_TIMEOUT_MS) || 90000, 15000), 300000);

async function apiRequest(apiPath: string, body: unknown) {
  const response = await fetch(new URL(apiPath, origin), {
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${workerKey}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Worker API ${apiPath} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

async function writePrivateJson(filename: string, value: unknown) {
  const temporaryPath = `${filename}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filename);
}

async function reportFailure(candidateId: number, leaseToken: string, message: string) {
  return z
    .object({ status: z.enum(['retry', 'failed']) })
    .parse(await apiRequest('/api/crawl/worker/fail', { candidateId, leaseToken, message: message.slice(0, 1000) }))
    .status;
}

async function prepare() {
  const runId = randomUUID();
  const { jobsDirectory, resultsDirectory, statePath, stateRoot } = getAgentRunPaths(process.cwd(), runId);
  await mkdir(jobsDirectory, { mode: 0o700, recursive: true });
  await mkdir(resultsDirectory, { mode: 0o700, recursive: true });
  await mkdir(stateRoot, { mode: 0o700, recursive: true });

  const claimed = claimResponseSchema.parse(await apiRequest('/api/crawl/worker/claim', { limit: batchSize }));
  const state: State = { categories: claimed.categories, jobs: [] };
  await writePrivateJson(statePath, state);
  const failures: Array<{ candidateId: number; status: 'failed' | 'retry' }> = [];

  for (let index = 0; index < claimed.candidates.length; index += 1) {
    const candidate = claimed.candidates[index];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('External crawler job deadline exceeded')), jobTimeoutMs);
    try {
      // Jobs stay sequential to bound outbound load and keep each page associated with one lease.
      // eslint-disable-next-line no-await-in-loop
      const website = await crawlWebsite(candidate.url, {
        deadline: Date.now() + jobTimeoutMs,
        signal: controller.signal,
      });
      state.jobs.push({ candidateId: candidate.id, leaseToken: candidate.leaseToken, website });
      // Persist lease state before exposing the untrusted page data to the agent.
      // eslint-disable-next-line no-await-in-loop
      await writePrivateJson(statePath, state);
      const job = agentJobSchema.parse({
        candidateId: candidate.id,
        canonicalUrl: website.canonicalUrl,
        categories: claimed.categories,
        editorialInstructions: makeEditorialGuidance(claimed.categories),
        originalDescription: website.description,
        pageContent: website.detail,
        title: website.title,
      });
      // eslint-disable-next-line no-await-in-loop
      await writePrivateJson(path.join(jobsDirectory, `${candidate.id}.json`), job);
    } catch (error) {
      const stateIndex = state.jobs.findIndex((job) => job.candidateId === candidate.id);
      if (stateIndex >= 0) {
        state.jobs.splice(stateIndex, 1);
        // eslint-disable-next-line no-await-in-loop
        await writePrivateJson(statePath, state);
      }
      const message = error instanceof Error ? error.message : 'Unknown crawler error';
      // eslint-disable-next-line no-await-in-loop
      const status = await reportFailure(candidate.id, candidate.leaseToken, message);
      failures.push({ candidateId: candidate.id, status });
    } finally {
      clearTimeout(timer);
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      claimed: claimed.candidates.length,
      failed: failures,
      jobs: state.jobs.map((job) => `.crawler-worker/${runId}/jobs/${job.candidateId}.json`),
      prepared: state.jobs.length,
      resultsDirectory: `.crawler-worker/${runId}/results`,
      runId,
    })}\n`,
  );
}

async function readJson(filename: string) {
  return JSON.parse(await readFile(filename, 'utf8')) as unknown;
}

async function submit(runId: string) {
  const { resultsDirectory, statePath, workDirectory } = getAgentRunPaths(process.cwd(), runId);
  const state = stateSchema.parse(await readJson(statePath));
  const results: Array<{ candidateId: number; status: string }> = [];

  for (let index = 0; index < state.jobs.length; index += 1) {
    const job = state.jobs[index];
    const outputPath = path.join(resultsDirectory, `${job.candidateId}.json`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const output = parseAgentOutput(await readJson(outputPath), job.candidateId, state.categories, [
        configuredWorkerKey,
        job.leaseToken,
      ]);
      const result = buildWorkerResult(job.website as ExtractedWebsite, output);
      // eslint-disable-next-line no-await-in-loop
      const responseBody = await apiRequest('/api/crawl/worker/result', {
        ...result,
        candidateId: job.candidateId,
        leaseToken: job.leaseToken,
      });
      const response = z.object({ status: z.enum(['review', 'already_completed']) }).parse(responseBody);
      results.push({ candidateId: job.candidateId, status: response.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown agent output error';
      // eslint-disable-next-line no-await-in-loop
      const status = await reportFailure(job.candidateId, job.leaseToken, `Agent output validation failed: ${message}`);
      results.push({ candidateId: job.candidateId, status });
    }
  }

  await rm(workDirectory, { force: true, recursive: true });
  await rm(statePath, { force: true });
  process.stdout.write(`${JSON.stringify({ results, runId, submitted: results.length })}\n`);
}

const command = process.argv[2];
let operation: (() => Promise<void>) | null = null;
if (command === 'prepare') operation = prepare;
if (command === 'submit') operation = () => submit(process.argv[3]);
if (!operation) throw new Error('Usage: tsx scripts/crawl-agent-worker.ts prepare | submit <run-id>');

operation().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'External crawler agent worker failed'}\n`);
  process.exitCode = 1;
});
