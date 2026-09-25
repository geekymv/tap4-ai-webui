import { z } from 'zod';

import { containsUnsafeMarkdown } from './enrich';

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
      .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
    categoryName: z.string().min(1).max(100).nullable(),
    description: z.string().trim().min(1).max(600),
    detail: z
      .string()
      .trim()
      .min(1)
      .max(15000)
      .refine((value) => !containsUnsafeMarkdown(value), 'detail must not contain links, images, or HTML'),
    imageUrl: z
      .string()
      .url()
      .max(2048)
      .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))
      .nullable(),
    title: z.string().trim().min(1).max(300),
  })
  .strict();

export const workerFailureSchema = candidateLeaseSchema
  .extend({ message: z.string().trim().min(1).max(1000) })
  .strict();

export type WorkerResultInput = z.infer<typeof workerResultSchema>;
