import 'server-only';

import { Sql } from 'postgres';

import getDatabase from '../../db/postgres';
import createCrawlerWorkerStore, { CrawlerWorkerStore } from './worker-store-factory';

export * from './worker-store-factory';

export default function getCrawlerWorkerStore(sql: Sql = getDatabase()): CrawlerWorkerStore {
  return createCrawlerWorkerStore(sql);
}
