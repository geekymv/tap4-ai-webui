import { describe, expect, it } from 'vitest';

import { makeEditorialGuidance } from './editorial-guidance';

describe('crawler editorial guidance', () => {
  it('adapts the tap4-ai-crawler SEO template without allowing unsupported claims', () => {
    const guidance = makeEditorialGuidance([
      { name: 'writing', title: 'AI Writing' },
      { name: 'other', title: 'Other' },
    ]);

    expect(guidance).toContain('Overview/What Is It');
    expect(guidance).toContain('Key Features and How to Use to Use Cases, Pricing, Helpful Tips');
    expect(guidance).toContain('Frequently Asked Questions');
    expect(guidance).toContain('Every section must start with exactly one level-3 heading');
    expect(guidance).toContain('3 to 6 source-supported sections');
    expect(guidance).toContain('800 to 2000 characters');
    expect(guidance).toContain('no longer than three sentences');
    expect(guidance).toContain('Deduplicate repeated claims');
    expect(guidance).toContain('Do not output source-page labels');
    expect(guidance).toContain('do not keyword-stuff');
    expect(guidance).toContain('Omit any section that the source does not support');
    expect(guidance).toContain('"name":"writing"');
  });
});
