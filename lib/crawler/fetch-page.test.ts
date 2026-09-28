import { createServer, RequestListener, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import crawlWebsite, { CrawlDeadlineError, fetchText } from './fetch-page';

const servers: Server[] = [];

async function listen(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return (server.address() as AddressInfo).port;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

const localTarget = async () => ({ address: '127.0.0.1', family: 4 });

describe('multi-page website crawling', () => {
  it('checks robots.txt before following an entry-page redirect to another origin', async () => {
    const requested: string[] = [];
    const port = await listen((request, response) => {
      const host = request.headers.host || '';
      const requestUrl = request.url || '/';
      requested.push(`${host}${requestUrl}`);
      if (requestUrl === '/robots.txt') {
        response.setHeader('content-type', 'text/plain');
        response.end(host.startsWith('blocked.test') ? 'User-agent: *\nDisallow: /' : 'User-agent: *\nAllow: /');
        return;
      }
      if (requestUrl === '/') {
        response.writeHead(302, { Location: `http://blocked.test:${port}/private` }).end();
        return;
      }
      response.end('<title>Private</title><meta name="description" content="Private content."><main>Private.</main>');
    });

    await expect(
      crawlWebsite(`http://allowed.test:${port}/`, {
        deadline: Date.now() + 5000,
        pagesPerSite: 1,
        resolveTarget: localTarget,
      }),
    ).rejects.toThrow('robots.txt does not allow');
    expect(requested).toContain(`blocked.test:${port}/robots.txt`);
    expect(requested).not.toContain(`blocked.test:${port}/private`);
  });

  it('fetches selected same-origin pages and reuses robots.txt', async () => {
    const requested: string[] = [];
    const port = await listen((request, response) => {
      const requestUrl = request.url || '/';
      requested.push(requestUrl);
      response.setHeader('content-type', requestUrl === '/robots.txt' ? 'text/plain' : 'text/html');
      if (requestUrl === '/robots.txt') {
        response.end('User-agent: *\nAllow: /');
        return;
      }
      if (requestUrl === '/') {
        response.end(`<title>Example AI</title>
          <meta name="description" content="An AI product for teams.">
          <main>Build useful content for product teams with a focused AI workflow.</main>
          <a href="/features">Features</a><a href="/pricing">Pricing</a>
          <a href="/login">Login</a><a href="https://other.example/about">External</a>`);
        return;
      }
      if (requestUrl === '/features') {
        response.end(
          '<title>Features</title><meta name="description" content="Product features."><main>Drafting, editing, and team review features.</main>',
        );
        return;
      }
      if (requestUrl === '/pricing') {
        response.end(
          '<title>Pricing</title><meta name="description" content="Pricing information."><main>Free trial and paid team plans are available.</main>',
        );
        return;
      }
      response.writeHead(404).end();
    });

    const website = await crawlWebsite(`http://pages.test:${port}/`, {
      deadline: Date.now() + 15000,
      pagesPerSite: 3,
      resolveTarget: localTarget,
    });

    expect(website.detail).toContain('Drafting, editing, and team review features');
    expect(website.detail).toContain('Free trial and paid team plans');
    expect(requested.filter((path) => path === '/robots.txt')).toHaveLength(1);
    expect(requested).not.toContain('/login');
  });
});

describe('absolute crawler deadline', () => {
  it('destroys a response that keeps dripping data before the inactivity timeout', async () => {
    const port = await listen((_request, response) => {
      response.on('error', () => undefined);
      response.writeHead(200, { 'content-type': 'text/plain' });
      const interval = setInterval(() => response.write('.'), 10);
      response.on('close', () => clearInterval(interval));
    });
    const startedAt = Date.now();

    await expect(
      fetchText(`http://drip.test:${port}/`, 'text/plain', {
        deadline: startedAt + 50,
        resolveTarget: localTarget,
      }),
    ).rejects.toBeInstanceOf(CrawlDeadlineError);
    expect(Date.now() - startedAt).toBeLessThan(300);
  });

  it('shares one deadline across the complete redirect chain', async () => {
    const port = await listen((request, response) => {
      response.on('error', () => undefined);
      const hop = Number(new URL(request.url || '/', 'http://redirect.test').searchParams.get('hop') || 0);
      setTimeout(() => {
        if (hop < 5) {
          response.writeHead(302, { Location: `/?hop=${hop + 1}` });
          response.end();
        } else {
          response.end('done');
        }
      }, 20);
    });
    const startedAt = Date.now();

    await expect(
      fetchText(`http://redirect.test:${port}/?hop=0`, 'text/plain', {
        deadline: startedAt + 55,
        resolveTarget: localTarget,
      }),
    ).rejects.toBeInstanceOf(CrawlDeadlineError);
    expect(Date.now() - startedAt).toBeLessThan(300);
  });
});
