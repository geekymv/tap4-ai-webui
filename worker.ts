import openNextWorker from './.open-next/worker.js';

export default {
  fetch: openNextWorker.fetch,
  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    if (!env.NEXT_PUBLIC_SITE_URL || !env.CRON_SECRET) {
      console.error('Scheduled discovery requires NEXT_PUBLIC_SITE_URL and CRON_SECRET');
      return;
    }
    const request = new Request(new URL('/api/cron/discover', env.NEXT_PUBLIC_SITE_URL), {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const fetchHandler = openNextWorker.fetch!;
    ctx.waitUntil(
      Promise.resolve(fetchHandler(request as Parameters<typeof fetchHandler>[0], env, ctx)).then((response) => {
        if (!response.ok) throw new Error(`Scheduled discovery returned HTTP ${response.status}`);
      }),
    );
  },
};
