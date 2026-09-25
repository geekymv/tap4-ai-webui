import { describe, expect, it } from 'vitest';

import { workerClaimSchema, workerFailureSchema, workerResultSchema } from './worker-contract';

const validResult = {
  candidateId: 1,
  canonicalUrl: 'https://example.com/',
  categoryName: 'writing',
  description: 'A factual summary.',
  detail: '## Overview\n\nA factual product overview without remote content.',
  imageUrl: null,
  leaseToken: 'a'.repeat(43),
  title: 'Example',
};

describe('external crawler worker contract', () => {
  it('bounds claim batches', () => {
    expect(workerClaimSchema.parse({})).toEqual({ limit: 5 });
    expect(() => workerClaimSchema.parse({ limit: 6 })).toThrow();
  });

  it('accepts safe review content', () => {
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

  it('rejects non-HTTP canonical and image URLs', () => {
    expect(() => workerResultSchema.parse({ ...validResult, canonicalUrl: 'file:///etc/passwd' })).toThrow();
    expect(() => workerResultSchema.parse({ ...validResult, imageUrl: 'data:text/plain,test' })).toThrow();
  });

  it('limits failure messages and lease tokens', () => {
    expect(() => workerFailureSchema.parse({ candidateId: 1, leaseToken: 'short', message: 'failed' })).toThrow();
    expect(() =>
      workerFailureSchema.parse({ candidateId: 1, leaseToken: 'a'.repeat(43), message: 'x'.repeat(1001) }),
    ).toThrow();
  });
});
