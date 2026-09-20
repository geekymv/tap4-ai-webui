import robotsParser from 'robots-parser';

import { extractWebsite } from './extract';
import { normalizeUrl } from './normalize';
import { assertSafeUrl } from './url-safety';

const USER_AGENT = 'GetAIToolsBot/1.0 (+https://getaitools.app/)';
const MAX_BYTES = 2 * 1024 * 1024;

async function readText(response: Response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES) throw new Error('Response exceeds the 2 MB limit');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  while (!done) {
    // Streaming is intentionally sequential so the byte limit can stop the response early.
    // eslint-disable-next-line no-await-in-loop
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.done) break;
    const { value } = chunk;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => undefined);
      throw new Error('Response exceeds the 2 MB limit');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(bytes);
}

async function fetchText(input: string, accept: string, redirectCount = 0): Promise<{ text: string; url: string }> {
  const url = normalizeUrl(input);
  await assertSafeUrl(url);
  const response = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect response is missing Location');
    if (redirectCount >= 5) throw new Error('Too many redirects');
    return fetchText(new URL(location, url).toString(), accept, redirectCount + 1);
  }
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  return { text: await readText(response), url };
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
  await assertSafeUrl(url);
  await assertRobotsAllowed(url);
  const response = await fetchText(url, 'text/html,application/xhtml+xml');
  return extractWebsite(response.text, response.url);
}
