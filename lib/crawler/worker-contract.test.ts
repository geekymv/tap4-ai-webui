import { describe, expect, it } from 'vitest';

import { haveSameHttpHost, workerClaimSchema, workerFailureSchema, workerResultSchema } from './worker-contract';

const validResult = {
  candidateId: 1,
  canonicalUrl: 'https://example.com/',
  categoryName: 'writing',
  description: 'A factual summary of the product and its supported team workflow.',
  detail: `### Overview

Example helps product teams prepare launch content from structured briefs while keeping supplied facts central to each draft. The workspace supports repeatable communication work and keeps drafts available for editorial review.

Teams can prepare release notes, documentation, and launch copy from the same source information. They remain responsible for checking the result before publication.

### Key Features

- Drafts release notes from structured briefs
- Produces product documentation from supplied facts
- Creates launch copy for product teams
- Supports revision in one workspace

These capabilities keep drafting and editing in a consistent process. The generated material remains limited to the product information supplied by users.

### How to Use

Users provide a structured brief and select the type of material they need. Example creates a draft that can be inspected and revised in the workspace.

Editors verify important claims, adjust wording for their audience, and approve the finished copy for publication. This review keeps the final communication aligned with the original brief.`,
  imageUrl: null,
  leaseToken: 'a'.repeat(43),
  title: 'Example',
};

describe('external crawler worker contract', () => {
  it('bounds claim batches', () => {
    expect(workerClaimSchema.parse({})).toEqual({ limit: 5 });
    expect(() => workerClaimSchema.parse({ limit: 6 })).toThrow();
  });

  it('accepts safe publication content', () => {
    expect(workerResultSchema.parse(validResult)).toMatchObject({ candidateId: 1, categoryName: 'writing' });
  });

  it.each([
    '![pixel][tracker]\n\n[tracker]: https://tracker.example/pixel.png',
    '[click][target]\n\n[target]: https://malicious.example',
    '<img src="https://tracker.example/pixel.png">',
  ])('rejects unsafe Markdown nodes', (detail) => {
    expect(() => workerResultSchema.parse({ ...validResult, detail })).toThrow(
      'detail must not contain links, images, or HTML',
    );
  });

  it('rejects shallow headings and plain-text sensitive output', () => {
    expect(() => workerResultSchema.parse({ ...validResult, detail: '## Overview\n\nUnsafe heading depth.' })).toThrow(
      'detail headings must start at h3',
    );
    expect(() =>
      workerResultSchema.parse({ ...validResult, description: 'Contact admin@example.com for this product.' }),
    ).toThrow('description must not contain URLs or secrets');
    expect(() =>
      workerResultSchema.parse({ ...validResult, detail: '### Overview\n\nVisit https://evil.example for details.' }),
    ).toThrow('detail must not contain URLs or secrets');
  });

  it('only treats exact or www host variants as the same source', () => {
    expect(haveSameHttpHost('https://example.com/', 'https://www.example.com/image.png')).toBe(true);
    expect(haveSameHttpHost('https://example.com/', 'https://cdn.example.com/image.png')).toBe(false);
    expect(haveSameHttpHost('https://user.github.io/', 'https://other.github.io/image.png')).toBe(false);
  });

  it('rejects non-HTTP canonical and image URLs', () => {
    expect(() => workerResultSchema.parse({ ...validResult, canonicalUrl: 'file:///etc/passwd' })).toThrow();
    expect(() => workerResultSchema.parse({ ...validResult, imageUrl: 'data:text/plain,test' })).toThrow();
    expect(() => workerResultSchema.parse({ ...validResult, imageUrl: 'https://user:pass@example.com/a' })).toThrow();
  });

  it('limits failure messages and lease tokens', () => {
    expect(() => workerFailureSchema.parse({ candidateId: 1, leaseToken: 'short', message: 'failed' })).toThrow();
    expect(() =>
      workerFailureSchema.parse({ candidateId: 1, leaseToken: 'a'.repeat(43), message: 'x'.repeat(1001) }),
    ).toThrow();
  });
});
