import { describe, expect, it } from 'vitest';

import { hasInvalidMarkdownLayout } from './output-validation';

const cleanDetail = `### Overview

This tool helps product teams prepare structured launch content from supplied briefs.

### Key Features

- Drafts release notes
- Produces product documentation
- Supports review workflows

### How to Use

Teams provide a product brief, review the generated draft, and revise it before publication.`;

describe('crawler output layout validation', () => {
  it('accepts concise, consistently structured Markdown', () => {
    expect(hasInvalidMarkdownLayout(cleanDetail)).toBe(false);
  });

  it.each([
    ['a single unstructured section', '### Overview\n\nOnly one long section is present without useful organization.'],
    ['source-page labels', cleanDetail.replace('This tool', 'Supporting page: This tool')],
    [
      'an empty section',
      cleanDetail.replace(
        '### Key Features\n\n- Drafts release notes\n- Produces product documentation\n- Supports review workflows\n\n',
        '### Key Features\n\n',
      ),
    ],
    ['duplicate headings', cleanDetail.replace('### How to Use', '### Overview')],
    ['a wall of text', `### Overview\n\n${'word '.repeat(150)}\n\n### Features\n\nUseful feature details.`],
    [
      'an oversized list',
      `### Overview\n\nUseful overview.\n\n### Features\n\n${Array.from({ length: 8 }, (_, index) => `- Feature ${index + 1}`).join('\n')}`,
    ],
  ])('rejects %s', (_name, detail) => {
    expect(hasInvalidMarkdownLayout(detail)).toBe(true);
  });
});
