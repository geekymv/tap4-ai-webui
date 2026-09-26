import { describe, expect, it } from 'vitest';

import { haveSameHttpHost, workerClaimSchema, workerFailureSchema, workerResultSchema } from './worker-contract';

const validResult = {
  candidateId: 1,
  canonicalUrl: 'https://example.com/',
  categoryName: 'writing',
  description: 'A factual summary.',
  detail: '### Overview\n\nA factual product overview without remote content.',
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
