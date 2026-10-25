import { describe, expect, it } from 'vitest';

import { getIntentPage, intentPages } from './intent-pages';

const supportedLocales = ['en', 'jp', 'de', 'es', 'fr', 'pt', 'ru', 'cn', 'tw'];

describe('intent pages', () => {
  it('defines exactly 20 unique pilot routes', () => {
    expect(intentPages).toHaveLength(20);
    expect(new Set(intentPages.map(({ slug }) => slug)).size).toBe(20);
  });

  it('provides a localized label for every supported locale', () => {
    intentPages.forEach((page) => {
      expect(Object.keys(page.labels).sort()).toEqual([...supportedLocales].sort());
      expect(Object.values(page.labels).every(Boolean)).toBe(true);
      expect(getIntentPage(page.slug)).toEqual(page);
    });
  });
});
