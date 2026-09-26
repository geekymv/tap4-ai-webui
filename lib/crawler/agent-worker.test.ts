import { describe, expect, it } from 'vitest';

import { buildWorkerResult, parseAgentOutput } from './agent-worker';

const categories = [
  { name: 'writing', title: 'Writing' },
  { name: 'other', title: 'Other' },
];
const validOutput = {
  candidateId: 42,
  categoryName: 'writing',
  description: 'A factual description of this AI writing tool and its supported workflow.',
  detail:
    '## Overview\n\nThis tool helps users draft and revise text from supplied prompts while keeping the editing workflow in one place.\n\n## Key Features\n\n- Draft generation from user instructions\n- Revision support for existing text\n- A focused workspace for reviewing generated copy',
};

describe('agent worker output', () => {
  it('accepts valid output and an allowed category', () => {
    expect(parseAgentOutput(validOutput, 42, categories)).toEqual(validOutput);
  });

  it('rejects a mismatched candidate or unknown category', () => {
    expect(() => parseAgentOutput(validOutput, 41, categories)).toThrow('candidateId');
    expect(() => parseAgentOutput({ ...validOutput, categoryName: 'internal' }, 42, categories)).toThrow(
      'allowed category',
    );
  });

  it('rejects unsafe or undersized generated content', () => {
    expect(() =>
      parseAgentOutput(
        { ...validOutput, detail: `${validOutput.detail}\n[Visit](https://example.com)` },
        42,
        categories,
      ),
    ).toThrow();
    expect(() => parseAgentOutput({ ...validOutput, description: 'Too short' }, 42, categories)).toThrow();
  });

  it('keeps crawler-owned fields and drops a third-party image', () => {
    const result = buildWorkerResult(
      {
        canonicalUrl: 'https://example.com/tool',
        description: 'Original',
        detail: 'Original detail',
        imageUrl: 'https://cdn.example.net/image.png',
        title: 'Crawler title',
      },
      validOutput,
    );
    expect(result).toMatchObject({
      canonicalUrl: 'https://example.com/tool',
      description: validOutput.description,
      imageUrl: null,
      title: 'Crawler title',
    });
  });
});
