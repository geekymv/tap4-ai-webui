import { describe, expect, it } from 'vitest';

import classifyWebsite from './classify';
import { combineWebsitePages, extractWebsite, selectInternalContentLinks } from './extract';
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

  it('selects only high-value same-origin content pages', () => {
    const links = selectInternalContentLinks(
      `<a href="/pricing">Pricing</a>
       <a href="/features?utm_source=nav">Features</a>
       <a href="/login">Log in</a>
       <a href="https://other.example/about">About them</a>
       <a href="/logo.svg">Logo</a>`,
      'https://example.com/',
      3,
    );

    expect(links).toEqual(['https://example.com/features', 'https://example.com/pricing']);
  });

  it('combines primary and supporting pages within the content budget', () => {
    const homepage = extractWebsite(
      '<title>Example</title><meta name="description" content="Main product overview."><main>Main product facts.</main>',
      'https://example.com/',
    );
    const pricing = extractWebsite(
      '<title>Pricing</title><meta name="description" content="Pricing details."><main>Free and paid plans.</main>',
      'https://example.com/pricing',
    );

    const combined = combineWebsitePages(homepage, [pricing]);

    expect(combined.canonicalUrl).toBe(homepage.canonicalUrl);
    expect(combined.detail).toContain('Primary page: Example');
    expect(combined.detail).toContain('Supporting page: Pricing');
    expect(combined.detail).toContain('Free and paid plans');
    expect(combined.detail.length).toBeLessThanOrEqual(12000);
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
