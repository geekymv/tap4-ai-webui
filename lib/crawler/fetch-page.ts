import { ClientRequest, request as httpRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import robotsParser from 'robots-parser';

import { combineWebsitePages, extractWebsite, selectInternalContentLinks } from './extract';
import { normalizeUrl } from './normalize';
import { createPinnedLookup, resolveSafeTarget } from './url-safety';

const USER_AGENT = 'GetAIToolsBot/1.0 (+https://getaitools.app/)';
const MAX_BYTES = 2 * 1024 * 1024;

type SafeTarget = Awaited<ReturnType<typeof resolveSafeTarget>>;

export type CrawlDeadline = {
  beforeRedirect?: (url: string) => Promise<void>;
  deadline: number;
  pagesPerSite?: number;
  signal?: AbortSignal;
  resolveTarget?: (url: string) => Promise<SafeTarget>;
};

export class CrawlDeadlineError extends Error {
  constructor() {
    super('Crawler deadline exceeded');
    this.name = 'CrawlDeadlineError';
  }
}

function deadlineError(signal?: AbortSignal) {
  return signal?.reason instanceof Error ? signal.reason : new CrawlDeadlineError();
}

function remainingTime({ deadline, signal }: CrawlDeadline) {
  if (signal?.aborted || Date.now() >= deadline) throw deadlineError(signal);
  return deadline - Date.now();
}

async function beforeDeadline<T>(promise: Promise<T>, options: CrawlDeadline): Promise<T> {
  const timeoutMs = remainingTime(options);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(deadlineError(options.signal));
    const timer = setTimeout(() => reject(new CrawlDeadlineError()), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function readText(response: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const contentLength = Number(response.headers['content-length'] || 0);
    if (contentLength > MAX_BYTES) {
      response.destroy();
      reject(new Error('Response exceeds the 2 MB limit'));
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    response.on('data', (value: Buffer | string) => {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      total += chunk.byteLength;
      if (total > MAX_BYTES) {
        response.destroy(new Error('Response exceeds the 2 MB limit'));
        return;
      }
      chunks.push(chunk);
    });
    response.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.once('error', reject);
  });
}

export async function fetchText(
  input: string,
  accept: string,
  options: CrawlDeadline,
  redirectCount = 0,
): Promise<{ text: string; url: string }> {
  remainingTime(options);
  const url = normalizeUrl(input);
  const parsedUrl = new URL(url);
  const target = await beforeDeadline((options.resolveTarget || resolveSafeTarget)(url), options);
  const transport = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    let settled = false;
    let request: ClientRequest;
    let timer: NodeJS.Timeout;
    const abortRequest = () => request.destroy(deadlineError(options.signal));
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortRequest);
      callback();
    };
    request = transport(
      parsedUrl,
      {
        headers: { Accept: accept, 'User-Agent': USER_AGENT },
        lookup: createPinnedLookup(target),
        servername: parsedUrl.hostname,
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          const { location } = response.headers;
          response.resume();
          if (!location) {
            finish(() => reject(new Error('Redirect response is missing Location')));
            return;
          }
          if (redirectCount >= 5) {
            finish(() => reject(new Error('Too many redirects')));
            return;
          }
          const redirectUrl = new URL(location, url).toString();
          const followRedirect = async () => {
            if (options.beforeRedirect) await options.beforeRedirect(redirectUrl);
            return fetchText(redirectUrl, accept, options, redirectCount + 1);
          };
          followRedirect().then(
            (value) => finish(() => resolve(value)),
            (error) => finish(() => reject(error)),
          );
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          finish(() => reject(new Error(`Website returned HTTP ${status}`)));
          return;
        }
        readText(response).then(
          (text) => {
            finish(() => resolve({ text, url }));
          },
          (error) => {
            finish(() => reject(error));
          },
        );
      },
    );
    timer = setTimeout(() => request.destroy(new CrawlDeadlineError()), remainingTime(options));
    options.signal?.addEventListener('abort', abortRequest, { once: true });
    request.once('error', (error) => finish(() => reject(error)));
    request.end();
  });
}

type RobotsPolicy = ReturnType<typeof robotsParser> | null;

async function assertRobotsAllowed(
  pageUrl: string,
  options: CrawlDeadline,
  policies: Map<string, Promise<RobotsPolicy>>,
) {
  const { origin } = new URL(pageUrl);
  const robotsUrl = `${origin}/robots.txt`;
  let policyPromise = policies.get(origin);
  if (!policyPromise) {
    policyPromise = fetchText(robotsUrl, 'text/plain', { ...options, beforeRedirect: undefined })
      .then(({ text }) => robotsParser(robotsUrl, text))
      .catch((error) => {
        if (error instanceof CrawlDeadlineError || options.signal?.aborted) throw error;
        return null;
      });
    policies.set(origin, policyPromise);
  }
  const policy = await policyPromise;
  if (policy && !policy.isAllowed(pageUrl, USER_AGENT)) {
    throw new Error('robots.txt does not allow this page to be crawled');
  }
}

function boundedInteger(value: number | string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export default async function crawlWebsite(input: string, options?: CrawlDeadline) {
  const timeoutMs = boundedInteger(process.env.CRAWL_REQUEST_TIMEOUT_MS, 7000, 30000);
  const crawlOptions = options || { deadline: Date.now() + timeoutMs };
  const pagesPerSite = boundedInteger(crawlOptions.pagesPerSite || process.env.CRAWL_PAGES_PER_SITE, 3, 5);
  const reserveMs = boundedInteger(process.env.CRAWL_ENRICHMENT_RESERVE_MS, 8000, 30000);
  const policies = new Map<string, Promise<RobotsPolicy>>();
  const url = normalizeUrl(input);
  await assertRobotsAllowed(url, crawlOptions, policies);
  const rootPageOptions = {
    ...crawlOptions,
    beforeRedirect: (redirectUrl: string) => assertRobotsAllowed(redirectUrl, crawlOptions, policies),
  };
  const response = await fetchText(url, 'text/html,application/xhtml+xml', rootPageOptions);
  const homepage = extractWebsite(response.text, response.url);
  const websiteOrigin = new URL(response.url).origin;
  const links = selectInternalContentLinks(response.text, response.url, pagesPerSite - 1);
  const supplementalPages = [];

  for (let index = 0; index < links.length; index += 1) {
    const availableMs = crawlOptions.deadline - Date.now() - reserveMs;
    if (availableMs < 1000 || crawlOptions.signal?.aborted) break;
    const pageDeadline = Date.now() + Math.min(timeoutMs, availableMs);
    const pageOptions: CrawlDeadline = {
      ...crawlOptions,
      beforeRedirect: async (redirectUrl) => {
        if (new URL(redirectUrl).origin !== websiteOrigin) {
          throw new Error('Supporting page redirected to another origin');
        }
        await assertRobotsAllowed(redirectUrl, { ...crawlOptions, deadline: pageDeadline }, policies);
      },
      deadline: pageDeadline,
    };
    try {
      // Keep requests sequential to avoid placing unexpected load on third-party sites.
      // eslint-disable-next-line no-await-in-loop
      await assertRobotsAllowed(links[index], pageOptions, policies);
      // eslint-disable-next-line no-await-in-loop
      const pageResponse = await fetchText(links[index], 'text/html,application/xhtml+xml', pageOptions);
      if (new URL(pageResponse.url).origin === websiteOrigin) {
        supplementalPages.push(extractWebsite(pageResponse.text, pageResponse.url));
      }
    } catch (error) {
      if (crawlOptions.signal?.aborted || Date.now() >= crawlOptions.deadline) throw error;
      // A missing, blocked, malformed, or slow supporting page must not discard a valid homepage.
    }
  }

  return combineWebsitePages(homepage, supplementalPages);
}
