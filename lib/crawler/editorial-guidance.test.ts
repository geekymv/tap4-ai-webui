import { describe, expect, it } from 'vitest';

import { makeEditorialGuidance } from './editorial-guidance';

describe('crawler editorial guidance', () => {
  it('adapts the tap4-ai-crawler SEO template without allowing unsupported claims', () => {
    const guidance = makeEditorialGuidance([
      { name: 'writing', title: 'AI Writing' },
      { name: 'other', title: 'Other' },
    ]);

    expect(guidance).toContain('What Is It, Key Features, How to Use, Pricing, Helpful Tips');
    expect(guidance).toContain('Frequently Asked Questions');
    expect(guidance).toContain('highest heading level must be h3');
    expect(guidance).toContain('do not keyword-stuff');
    expect(guidance).toContain('Omit any section that the source does not support');
    expect(guidance).toContain('"name":"writing"');
  });
});
