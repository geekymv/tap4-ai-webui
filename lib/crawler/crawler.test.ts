import { describe, expect, it } from 'vitest';

import classifyWebsite from './classify';
import { extractWebsite } from './extract';
import { normalizeUrl } from './normalize';
import { createPinnedLookup, isPrivateAddress, resolveSafeTarget } from './url-safety';

describe('normalizeUrl', () => {
  it('removes fragments and tracking parameters', () => {
    expect(normalizeUrl('https://Example.com/tool/?utm_source=test&b=2&a=1#demo')).toBe(
      'https://example.com/tool?a=1&b=2',
    );
  });

  it('rejects non-http protocols and credentials', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeUrl('https://user:pass@example.com')).toThrow();
  });
});

describe('URL safety', () => {
  it('recognizes private and public addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.2.3.4')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('pins the validated address instead of resolving again at connect time', async () => {
    let dnsAnswer = '93.184.216.34';
    let resolverCalls = 0;
    const target = await resolveSafeTarget('https://example.com', async () => {
      resolverCalls += 1;
      return [dnsAnswer];
    });
    dnsAnswer = '127.0.0.1';

    const connectedAddress = await new Promise<string>((resolve, reject) => {
      createPinnedLookup(target)('example.com', { all: false }, (error, address) => {
        if (error) reject(error);
        else resolve(String(address));
      });
    });

    expect(resolverCalls).toBe(1);
    expect(connectedAddress).toBe('93.184.216.34');
    expect(dnsAnswer).toBe('127.0.0.1');
  });
});

describe('extractWebsite', () => {
  it('extracts SEO metadata and visible content', () => {
    const website = extractWebsite(
      `<html><head>
        <title>Fallback</title>
        <meta property="og:title" content="AI Writer">
        <meta name="description" content="Write polished articles with AI.">
        <meta property="og:image" content="/cover.png">
        <link rel="canonical" href="/">
      </head><body><main>Generate articles, outlines, and summaries for your team.</main></body></html>`,
      'https://example.com/product',
    );
    expect(website.title).toBe('AI Writer');
    expect(website.canonicalUrl).toBe('https://example.com/');
    expect(website.imageUrl).toBe('https://example.com/cover.png');
    expect(website.detail).toContain('Generate articles');
  });
});

describe('classifyWebsite', () => {
  it('returns the closest matching category', () => {
    expect(
      classifyWebsite('AI Video Generator', 'Create video clips', [
        { name: 'writing', title: 'AI Writing' },
        { name: 'video', title: 'AI Video' },
      ]),
    ).toBe('video');
  });
});
