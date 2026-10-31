import 'server-only';

import getDatabase, { D1DatabaseClient } from '../../db/d1';
import createCrawlerWorkerStore, { CrawlerWorkerStore } from './worker-store-factory';

export * from './worker-store-factory';

export default function getCrawlerWorkerStore(database: D1DatabaseClient = getDatabase()): CrawlerWorkerStore {
  return createCrawlerWorkerStore(database);
}
