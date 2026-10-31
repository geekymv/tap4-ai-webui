import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export type D1DatabaseClient = Pick<D1Database, 'batch' | 'prepare'>;

declare global {
  interface CloudflareEnv {
    CRON_SECRET?: string;
    DB: D1Database;
    NEXT_PUBLIC_SITE_URL?: string;
  }
}

export default function getDatabase(): D1DatabaseClient {
  const database = getCloudflareContext().env.DB;
  if (!database) throw new Error('Cloudflare D1 binding "DB" is required');
  return database;
}
