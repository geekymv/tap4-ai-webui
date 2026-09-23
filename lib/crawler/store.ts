import { Sql } from 'postgres';

import getDatabase from '../../db/postgres';
import createCrawlerStore, { CrawlerStore } from './store-factory';

export * from './store-factory';

export default function getCrawlerStore(sql: Sql = getDatabase()): CrawlerStore {
  return createCrawlerStore(sql);
}
