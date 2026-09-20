import * as cheerio from 'cheerio';

import { normalizeUrl } from './normalize';

export type ExtractedWebsite = {
  canonicalUrl: string;
  description: string;
  detail: string;
  imageUrl: string | null;
  title: string;
};

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractWebsite(html: string, pageUrl: string): ExtractedWebsite {
  const $ = cheerio.load(html);
  const title = cleanText(
    $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').first().text(),
  );
  const description = cleanText(
    $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '',
  );
  const canonicalUrl = normalizeUrl(absoluteUrl($('link[rel="canonical"]').attr('href'), pageUrl) || pageUrl);
  const imageUrl = absoluteUrl(
    $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'),
    pageUrl,
  );
  $('script, style, noscript, svg, nav, footer, header, form').remove();
  const mainText = cleanText($('main').text() || $('article').text() || $('body').text()).slice(0, 12000);
  if (!title) throw new Error('The page does not contain a title');
  if (!description && mainText.length < 120) throw new Error('The page does not contain enough indexable content');

  const summary = description || mainText.slice(0, 300);
  return {
    canonicalUrl,
    description: summary,
    detail: [`## ${title}`, '', summary, '', mainText].join('\n').slice(0, 15000),
    imageUrl,
    title,
  };
}
