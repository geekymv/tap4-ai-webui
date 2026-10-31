import 'server-only';

import getDatabase from './d1';
import type { NavigationCategory, WebNavigation } from './types';

type ToolListOptions = {
  category?: string;
  excludeId?: number;
  limit?: number;
  offset?: number;
  order?: 'collection_time_desc' | 'id_asc' | 'id_desc';
  searchDetail?: string;
};

export async function listCategories(): Promise<NavigationCategory[]> {
  const { results } = await getDatabase()
    .prepare('SELECT * FROM navigation_category WHERE del_flag = 0 ORDER BY sort ASC, id ASC')
    .all<NavigationCategory>();
  return results;
}

export async function getCategory(name: string): Promise<NavigationCategory | null> {
  return getDatabase()
    .prepare('SELECT * FROM navigation_category WHERE name = ? AND del_flag = 0 LIMIT 1')
    .bind(name)
    .first<NavigationCategory>();
}

export async function countTools(category?: string): Promise<number> {
  const statement = category
    ? getDatabase().prepare('SELECT COUNT(*) AS count FROM web_navigation WHERE category_name = ?').bind(category)
    : getDatabase().prepare('SELECT COUNT(*) AS count FROM web_navigation');
  const row = await statement.first<{ count: number }>();
  return Number(row?.count || 0);
}

export async function listTools(options: ToolListOptions = {}): Promise<WebNavigation[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (options.category) {
    conditions.push('category_name = ?');
    values.push(options.category);
  }
  if (options.excludeId !== undefined) {
    conditions.push('id != ?');
    values.push(options.excludeId);
  }
  if (options.searchDetail !== undefined) {
    conditions.push("LOWER(COALESCE(detail, '')) LIKE LOWER(?) ESCAPE '\\'");
    values.push(`%${options.searchDetail.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const orders = {
    collection_time_desc: 'collection_time DESC, id DESC',
    id_asc: 'id ASC',
    id_desc: 'id DESC',
  } as const;
  let query = `SELECT * FROM web_navigation${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
  query += ` ORDER BY ${orders[options.order || 'id_desc']}`;
  if (options.limit !== undefined) {
    query += ' LIMIT ? OFFSET ?';
    values.push(Math.max(0, options.limit), Math.max(0, options.offset || 0));
  }
  const statement = getDatabase().prepare(query);
  const { results } = await (values.length ? statement.bind(...values) : statement).all<WebNavigation>();
  return results;
}

export async function getToolByName(name: string): Promise<WebNavigation | null> {
  return getDatabase().prepare('SELECT * FROM web_navigation WHERE name = ? LIMIT 1').bind(name).first<WebNavigation>();
}

export async function listSitemapTools(offset: number, limit: number) {
  const { results } = await getDatabase()
    .prepare('SELECT name, collection_time FROM web_navigation ORDER BY id ASC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Pick<WebNavigation, 'collection_time' | 'name'>>();
  return results;
}

export async function createSubmission(input: { email: string; name: string; url: string }) {
  const database = getDatabase();
  const existing = await database
    .prepare('SELECT 1 AS found FROM web_navigation WHERE url = ? LIMIT 1')
    .bind(input.url)
    .first<{ found: number }>();
  if (existing) return false;
  await database
    .prepare('INSERT INTO submit (email, name, url) VALUES (?, ?, ?)')
    .bind(input.email, input.name, input.url)
    .run();
  return true;
}
