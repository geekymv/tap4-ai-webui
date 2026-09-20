import { createServer, RequestListener, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { CrawlDeadlineError, fetchText } from './fetch-page';

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

describe('absolute crawler deadline', () => {
  it('destroys a response that keeps dripping data before the inactivity timeout', async () => {
    const port = await listen((_request, response) => {
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
