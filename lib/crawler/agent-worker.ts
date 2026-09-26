import { z } from 'zod';

import { containsUnsafeMarkdown } from './enrich';
import type { ExtractedWebsite } from './extract';
import { haveSameHttpHost } from './worker-contract';

export type WorkerCategory = { name: string; title: string | null };

export const agentJobSchema = z
  .object({
    candidateId: z.number().int().positive(),
    canonicalUrl: z.string().url(),
    categories: z.array(z.object({ name: z.string().min(1).max(100), title: z.string().nullable() })),
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
      .refine((value) => !/[\r\n]/.test(value), 'description must be plain text'),
    detail: z
      .string()
      .trim()
      .min(200)
      .max(15000)
      .refine((value) => !containsUnsafeMarkdown(value), 'detail must not contain links, images, or HTML'),
  })
  .strict();

export type AgentOutput = z.infer<typeof agentOutputSchema>;

export function parseAgentOutput(value: unknown, candidateId: number, categories: WorkerCategory[]) {
  const output = agentOutputSchema.parse(value);
  if (output.candidateId !== candidateId) throw new Error('candidateId does not match the prepared job');
  if (output.categoryName && !categories.some((category) => category.name === output.categoryName)) {
    throw new Error('categoryName is not in the allowed category list');
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
