import { describe, expect, it } from 'vitest';

import { languageAlternates, localizedUrl, safeJsonLd } from './seo';

describe('SEO helpers', () => {
  it('uses unprefixed English URLs and prefixed translated URLs', () => {
    expect(new URL(localizedUrl('en', '/ai/example')).pathname).toBe('/ai/example');
    expect(new URL(localizedUrl('cn', '/ai/example')).pathname).toBe('/cn/ai/example');
  });

  it('makes each localized page self-canonical with complete language alternates', () => {
    const alternates = languageAlternates('cn', '/best/ai-writing-assistants');
    expect(new URL(alternates.canonical).pathname).toBe('/cn/best/ai-writing-assistants');
    expect(new URL(alternates.languages.en).pathname).toBe('/best/ai-writing-assistants');
    expect(alternates.languages['x-default']).toBe(alternates.languages.en);
  });

  it('escapes HTML-significant characters in JSON-LD', () => {
    expect(safeJsonLd({ name: '</script>' })).not.toContain('<');
  });
});
