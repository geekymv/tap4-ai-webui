import { z } from 'zod';

import { containsSensitiveOutput, containsUnsafeMarkdown, hasShallowMarkdownHeading } from './output-validation';

function parsedHttpUrl(value: string) {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
}

function normalizedHostname(value: string) {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
}

export function haveSameHttpHost(first: string, second: string) {
  return normalizedHostname(first) === normalizedHostname(second);
}

export const workerClaimSchema = z
  .object({
    // eslint-disable-next-line newline-per-chained-call
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();

const candidateLeaseSchema = z.object({
  candidateId: z.number().int().positive(),
  leaseToken: z.string().min(32).max(256),
});

export const workerResultSchema = candidateLeaseSchema
  .extend({
    canonicalUrl: z
      .string()
      .url()
      .max(2048)
      .refine(parsedHttpUrl, 'canonicalUrl must be an HTTP URL without credentials'),
    categoryName: z.string().min(1).max(100).nullable(),
    description: z
      .string()
      .trim()
      .min(1)
      .max(600)
      .refine((value) => !containsSensitiveOutput(value), 'description must not contain URLs or secrets'),
    detail: z
      .string()
      .trim()
      .min(1)
      .max(15000)
      .refine((value) => !containsUnsafeMarkdown(value), 'detail must not contain links, images, or HTML')
      .refine((value) => !containsSensitiveOutput(value), 'detail must not contain URLs or secrets')
      .refine((value) => !hasShallowMarkdownHeading(value), 'detail headings must start at h3'),
    imageUrl: z
      .string()
      .url()
      .max(2048)
      .refine(parsedHttpUrl, 'imageUrl must be an HTTP URL without credentials')
      .nullable(),
    title: z.string().trim().min(1).max(300),
  })
  .strict();

export const workerFailureSchema = candidateLeaseSchema
  .extend({ message: z.string().trim().min(1).max(1000) })
  .strict();

export type WorkerResultInput = z.infer<typeof workerResultSchema>;
