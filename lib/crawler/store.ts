import 'server-only';

import getDatabase, { D1DatabaseClient } from '../../db/d1';
import createCrawlerStore, { CrawlerStore } from './store-factory';

export * from './store-factory';

export default function getCrawlerStore(database: D1DatabaseClient = getDatabase()): CrawlerStore {
  return createCrawlerStore(database);
}
