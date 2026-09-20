import { ClientRequest, request as httpRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import robotsParser from 'robots-parser';

import { extractWebsite } from './extract';
import { normalizeUrl } from './normalize';
import { createPinnedLookup, resolveSafeTarget } from './url-safety';

const USER_AGENT = 'GetAIToolsBot/1.0 (+https://getaitools.app/)';
const MAX_BYTES = 2 * 1024 * 1024;

type SafeTarget = Awaited<ReturnType<typeof resolveSafeTarget>>;

export type CrawlDeadline = {
  deadline: number;
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
          fetchText(new URL(location, url).toString(), accept, options, redirectCount + 1).then(
            (value) => {
              finish(() => resolve(value));
            },
            (error) => {
              finish(() => reject(error));
            },
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

async function assertRobotsAllowed(pageUrl: string, options: CrawlDeadline) {
  const robotsUrl = `${new URL(pageUrl).origin}/robots.txt`;
  try {
    const { text } = await fetchText(robotsUrl, 'text/plain', options);
    if (!robotsParser(robotsUrl, text).isAllowed(pageUrl, USER_AGENT)) {
      throw new Error('robots.txt does not allow this page to be crawled');
    }
  } catch (error) {
    if (error instanceof CrawlDeadlineError || options.signal?.aborted) throw error;
    if (error instanceof Error && error.message.includes('does not allow')) throw error;
  }
}

export default async function crawlWebsite(input: string, options?: CrawlDeadline) {
  const timeoutMs = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 7000;
  const crawlOptions = options || { deadline: Date.now() + timeoutMs };
  const url = normalizeUrl(input);
  await assertRobotsAllowed(url, crawlOptions);
  const response = await fetchText(url, 'text/html,application/xhtml+xml', crawlOptions);
  return extractWebsite(response.text, response.url);
}
