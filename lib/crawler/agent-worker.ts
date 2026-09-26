import path from 'node:path';
import { z } from 'zod';

import type { ExtractedWebsite } from './extract';
import { containsSensitiveOutput, containsUnsafeMarkdown, hasShallowMarkdownHeading } from './output-validation';
import { haveSameHttpHost } from './worker-contract';

export type WorkerCategory = { name: string; title: string | null };

export function getAgentRunPaths(baseDirectory: string, runId: string) {
  const validRunId = z.string().uuid().parse(runId);
  const workRoot = path.resolve(baseDirectory, '.crawler-worker');
  const workDirectory = path.join(workRoot, validRunId);
  return {
    jobsDirectory: path.join(workDirectory, 'jobs'),
    resultsDirectory: path.join(workDirectory, 'results'),
    statePath: path.resolve(baseDirectory, '.crawler-worker-private', `${validRunId}.json`),
    stateRoot: path.resolve(baseDirectory, '.crawler-worker-private'),
    workDirectory,
  };
}

export const agentJobSchema = z
  .object({
    candidateId: z.number().int().positive(),
    canonicalUrl: z.string().url(),
    categories: z.array(z.object({ name: z.string().min(1).max(100), title: z.string().nullable() })),
    editorialInstructions: z.string().min(1),
    originalDescription: z.string(),
    pageContent: z.string(),
    title: z.string().min(1),
  })
  .strict();

export const agentOutputSchema = z
  .object({
    candidateId: z.number().int().positive(),
    categoryName: z.string().min(1).max(100).nullable(),
    description: z
      .string()
      .trim()
      .min(40)
      .max(600)
      .refine((value) => !/[\r\n]/.test(value), 'description must be plain text')
      .refine((value) => !containsSensitiveOutput(value), 'description must not contain URLs or secrets'),
    detail: z
      .string()
      .trim()
      .min(200)
      .max(15000)
      .refine((value) => !containsUnsafeMarkdown(value), 'detail must not contain links, images, or HTML')
      .refine((value) => !containsSensitiveOutput(value), 'detail must not contain URLs or secrets')
      .refine((value) => !hasShallowMarkdownHeading(value), 'detail headings must start at h3'),
  })
  .strict();

export type AgentOutput = z.infer<typeof agentOutputSchema>;

export function parseAgentOutput(
  value: unknown,
  candidateId: number,
  categories: WorkerCategory[],
  forbiddenValues: string[] = [],
) {
  const output = agentOutputSchema.parse(value);
  if (output.candidateId !== candidateId) throw new Error('candidateId does not match the prepared job');
  if (output.categoryName && !categories.some((category) => category.name === output.categoryName)) {
    throw new Error('categoryName is not in the allowed category list');
  }
  const generatedContent = `${output.description}\n${output.detail}`;
  if (forbiddenValues.some((secret) => secret.length >= 16 && generatedContent.includes(secret))) {
    throw new Error('generated content contains protected runtime data');
  }
  return output;
}

export function buildWorkerResult(website: ExtractedWebsite, output: AgentOutput) {
  const imageUrl =
    website.imageUrl && haveSameHttpHost(website.canonicalUrl, website.imageUrl) ? website.imageUrl : null;
  return {
    canonicalUrl: website.canonicalUrl,
    categoryName: output.categoryName,
    description: output.description,
    detail: output.detail,
    imageUrl,
    title: website.title,
  };
}
