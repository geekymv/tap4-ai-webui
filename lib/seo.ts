import { locales } from '../i18n';
import { BASE_URL } from './env';

const siteUrl = BASE_URL.replace(/\/$/, '');

export function localizedUrl(locale: string, path = '') {
  const normalizedPath = path === '' || path === '/' ? '' : `/${path.replace(/^\//, '')}`;
  const localePath = locale === 'en' ? '' : `/${locale}`;
  return `${siteUrl}${localePath}${normalizedPath}`;
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function languageAlternates(locale: string, path = '') {
  return {
    canonical: localizedUrl(locale, path),
    languages: Object.fromEntries([
      ...locales.map((language) => [language, localizedUrl(language, path)]),
      ['x-default', localizedUrl('en', path)],
    ]),
  };
}
