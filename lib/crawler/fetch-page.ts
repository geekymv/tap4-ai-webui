import { request as httpRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import robotsParser from 'robots-parser';

import { extractWebsite } from './extract';
import { normalizeUrl } from './normalize';
import { createPinnedLookup, resolveSafeTarget } from './url-safety';

const USER_AGENT = 'GetAIToolsBot/1.0 (+https://getaitools.app/)';
const MAX_BYTES = 2 * 1024 * 1024;

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

async function fetchText(input: string, accept: string, redirectCount = 0): Promise<{ text: string; url: string }> {
  const url = normalizeUrl(input);
  const parsedUrl = new URL(url);
  const target = await resolveSafeTarget(url);
  const transport = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const timeoutMs = Number(process.env.CRAWL_REQUEST_TIMEOUT_MS) || 7000;

  return new Promise((resolve, reject) => {
    const request = transport(
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
            reject(new Error('Redirect response is missing Location'));
            return;
          }
          if (redirectCount >= 5) {
            reject(new Error('Too many redirects'));
            return;
          }
          fetchText(new URL(location, url).toString(), accept, redirectCount + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Website returned HTTP ${status}`));
          return;
        }
        readText(response)
          .then((text) => resolve({ text, url }))
          .catch(reject);
      },
    );
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Website request timed out after ${timeoutMs}ms`)));
    request.once('error', reject);
    request.end();
  });
}

async function assertRobotsAllowed(pageUrl: string) {
  const robotsUrl = `${new URL(pageUrl).origin}/robots.txt`;
  try {
    const { text } = await fetchText(robotsUrl, 'text/plain');
    if (!robotsParser(robotsUrl, text).isAllowed(pageUrl, USER_AGENT)) {
      throw new Error('robots.txt does not allow this page to be crawled');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not allow')) throw error;
  }
}

export default async function crawlWebsite(input: string) {
  const url = normalizeUrl(input);
  await assertRobotsAllowed(url);
  const response = await fetchText(url, 'text/html,application/xhtml+xml');
  return extractWebsite(response.text, response.url);
}
