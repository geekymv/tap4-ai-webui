import * as cheerio from 'cheerio';

import { normalizeUrl } from './normalize';

export type ExtractedWebsite = {
  canonicalUrl: string;
  description: string;
  detail: string;
  imageUrl: string | null;
  title: string;
};

const CONTENT_PATH_PATTERN =
  /(?:^|[\s\-_/])(about|benefits?|capabilities|customers?|docs?|faq|features?|how-it-works|integrations?|overview|platform|pricing|product|solutions?|use-cases?|案例|产品|价格|功能|关于|帮助|文档|方案)(?:$|[\s\-_/])/iu;
const EXCLUDED_PATH_PATTERN =
  /(?:^|[\s\-_/])(account|admin|auth|blog|careers?|cart|checkout|community|contact|cookie|download|events?|legal|login|news|partners?|privacy|register|signin|signup|support|terms)(?:$|[\s\-_/])/iu;
const ASSET_PATH_PATTERN =
  /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|json|mp3|mp4|pdf|png|pptx?|svg|txt|web[mp]|xlsx?|xml|zip)$/iu;

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

export function selectInternalContentLinks(html: string, pageUrl: string, limit: number) {
  if (limit < 1) return [];
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const candidates = new Map<string, { score: number; url: string }>();

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    try {
      const parsed = new URL(href, base);
      if (parsed.origin !== base.origin || parsed.username || parsed.password) return;
      const normalized = normalizeUrl(parsed.toString());
      if (normalized === normalizeUrl(pageUrl) || ASSET_PATH_PATTERN.test(parsed.pathname)) return;
      const searchable = `${parsed.pathname} ${cleanText($(element).text())}`;
      if (EXCLUDED_PATH_PATTERN.test(searchable) || !CONTENT_PATH_PATTERN.test(searchable)) return;
      const pathDepth = parsed.pathname.split('/').filter(Boolean).length;
      const score = (CONTENT_PATH_PATTERN.test(parsed.pathname) ? 10 : 5) - Math.min(pathDepth, 4);
      const existing = candidates.get(normalized);
      if (!existing || score > existing.score) candidates.set(normalized, { score, url: normalized });
    } catch {
      // Ignore malformed or unsupported links.
    }
  });

  return Array.from(candidates.values())
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, limit)
    .map(({ url }) => url);
}

export function combineWebsitePages(homepage: ExtractedWebsite, supplementalPages: ExtractedWebsite[]) {
  const pages = [homepage, ...supplementalPages];
  const maxCombinedCharacters = 12000;
  const perPageBudget = Math.floor(maxCombinedCharacters / pages.length);
  const detail = pages
    .map((page, index) => {
      const label = index === 0 ? 'Primary page' : 'Supporting page';
      return [`### ${label}: ${page.title}`, '', page.detail.slice(0, perPageBudget)].join('\n');
    })
    .join('\n\n')
    .slice(0, maxCombinedCharacters);
  return { ...homepage, detail };
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
    detail: [`### ${title}`, '', summary, '', mainText].join('\n').slice(0, 15000),
    imageUrl,
    title,
  };
}
