import { createHash, randomBytes } from 'node:crypto';

import type { D1DatabaseClient } from '../../db/d1';
import { normalizeUrl } from './normalize';
import { CrawlCandidate } from './store-factory';
import { haveSameHttpHost, WorkerResultInput } from './worker-contract';

const LEASE_MINUTES = 20;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const CLAIMABLE = `(status = 'pending'
  OR (status = 'retry' AND COALESCE(next_retry_at, ${NOW}) <= ${NOW})
  OR (status = 'processing' AND (
    (worker_lease_expires_at IS NOT NULL AND worker_lease_expires_at < ${NOW})
    OR (worker_lease_expires_at IS NULL AND locked_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes'))
  )))`;

type WorkerCandidate = CrawlCandidate & { leaseToken: string };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function publicationName(candidate: CrawlCandidate) {
  const baseName = candidate.domain
    .replace(/^www\./, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${baseName}-${candidate.id}`;
}

export interface CrawlerWorkerStore {
  claim(limit: number): Promise<WorkerCandidate[]>;
  complete(input: WorkerResultInput): Promise<{ categoryName: string; name: string; status: 'published' }>;
  fail(candidateId: number, leaseToken: string, message: string): Promise<{ status: 'failed' | 'retry' }>;
  listCategories(): Promise<Array<{ name: string; title: string | null }>>;
}

export default function createCrawlerWorkerStore(database: D1DatabaseClient): CrawlerWorkerStore {
  return {
    async claim(limit) {
      const { results: rows } = await database
        .prepare(`SELECT id FROM crawler_candidate WHERE ${CLAIMABLE} ORDER BY discovered_at ASC LIMIT ?`)
        .bind(Math.max(1, Math.min(limit, 5)))
        .all<{ id: number }>();
      const candidates = await Promise.all(
        rows.map(async (row) => {
          const leaseToken = randomBytes(32).toString('base64url');
          const candidate = await database
            .prepare(
              `UPDATE crawler_candidate
              SET status = 'processing', locked_at = ${NOW}, attempt_count = attempt_count + 1,
                  worker_lease_hash = ?, worker_lease_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${LEASE_MINUTES} minutes'),
                  error_message = NULL, updated_at = ${NOW}
              WHERE id = ? AND ${CLAIMABLE} RETURNING *`,
            )
            .bind(hashToken(leaseToken), row.id)
            .first<CrawlCandidate>();
          return candidate ? { ...candidate, leaseToken } : null;
        }),
      );
      return candidates.filter((candidate): candidate is WorkerCandidate => Boolean(candidate));
    },

    async complete(input) {
      const leaseHash = hashToken(input.leaseToken);
      const candidate = await database
        .prepare(
          `SELECT * FROM crawler_candidate WHERE id = ? AND status = 'processing'
          AND worker_lease_hash = ? AND worker_lease_expires_at > ${NOW}`,
        )
        .bind(input.candidateId, leaseHash)
        .first<CrawlCandidate>();
      if (!candidate) {
        const completed = await database
          .prepare(
            `SELECT canonical_url, category_name FROM crawler_candidate
            WHERE id = ? AND status = 'published' AND worker_lease_hash = ?`,
          )
          .bind(input.candidateId, leaseHash)
          .first<{ canonical_url: string; category_name: string }>();
        if (completed) {
          const published = await database
            .prepare('SELECT name FROM web_navigation WHERE url = ?')
            .bind(completed.canonical_url)
            .first<{ name: string }>();
          if (!published) throw new Error('published_navigation_missing');
          return { categoryName: completed.category_name, name: published.name, status: 'published' as const };
        }
        throw new Error('invalid_or_expired_lease');
      }
      const canonicalUrl = normalizeUrl(input.canonicalUrl);
      if (!haveSameHttpHost(candidate.url, canonicalUrl)) throw new Error('invalid_canonical_origin');
      if (input.imageUrl && !haveSameHttpHost(canonicalUrl, input.imageUrl)) throw new Error('invalid_image_origin');
      const categoryName = input.categoryName || 'other';
      const category = await database
        .prepare('SELECT name FROM navigation_category WHERE name = ? AND del_flag = 0')
        .bind(categoryName)
        .first<{ name: string }>();
      if (!category) throw new Error('invalid_category');
      const name = publicationName(candidate);
      const statements = [
        database
          .prepare(
            `INSERT INTO web_navigation (
              name, title, content, detail, url, image_url, thumbnail_url,
              collection_time, tag_name, category_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ${NOW}, ?, ?)
            ON CONFLICT(url) WHERE url IS NOT NULL DO UPDATE SET
              title = excluded.title, content = excluded.content, detail = excluded.detail,
              image_url = excluded.image_url, thumbnail_url = excluded.thumbnail_url,
              collection_time = excluded.collection_time, tag_name = excluded.tag_name,
              category_name = excluded.category_name`,
          )
          .bind(
            name,
            input.title,
            input.description,
            input.detail,
            canonicalUrl,
            input.imageUrl,
            input.imageUrl,
            categoryName,
            categoryName,
          ),
        database
          .prepare(
            `UPDATE crawler_candidate
            SET canonical_url = ?, category_name = ?, description = ?, detail = ?, error_message = NULL,
                image_url = ?, locked_at = NULL, next_retry_at = NULL, status = 'published',
                title = ?, updated_at = ${NOW}
            WHERE id = ? AND status = 'processing' AND worker_lease_hash = ?
              AND worker_lease_expires_at > ${NOW}`,
          )
          .bind(
            canonicalUrl,
            categoryName,
            input.description,
            input.detail,
            input.imageUrl,
            input.title,
            input.candidateId,
            leaseHash,
          ),
      ];
      if (candidate.source === 'submission' && candidate.source_item_id) {
        statements.push(database.prepare('UPDATE submit SET status = 1 WHERE id = ?').bind(candidate.source_item_id));
      }
      const results = await database.batch(statements);
      if (!results[1].success || Number(results[1].meta.changes || 0) !== 1) {
        throw new Error('invalid_or_expired_lease');
      }
      return { categoryName, name, status: 'published' as const };
    },

    async fail(candidateId, leaseToken, message) {
      const leaseHash = hashToken(leaseToken);
      const candidate = await database
        .prepare(
          `SELECT attempt_count FROM crawler_candidate WHERE id = ? AND status = 'processing'
          AND worker_lease_hash = ? AND worker_lease_expires_at > ${NOW}`,
        )
        .bind(candidateId, leaseHash)
        .first<{ attempt_count: number }>();
      if (!candidate) {
        const previous = await database
          .prepare(
            `SELECT status FROM crawler_candidate
            WHERE id = ? AND status IN ('retry', 'failed') AND worker_lease_hash = ?`,
          )
          .bind(candidateId, leaseHash)
          .first<{ status: 'failed' | 'retry' }>();
        if (previous) return { status: previous.status };
        throw new Error('invalid_or_expired_lease');
      }
      const retry = candidate.attempt_count < 3;
      const status = retry ? 'retry' : 'failed';
      const nextRetryAt = retry
        ? new Date(Date.now() + 2 ** candidate.attempt_count * 15 * 60 * 1000).toISOString()
        : null;
      await database
        .prepare(
          `UPDATE crawler_candidate SET error_message = ?, locked_at = NULL, next_retry_at = ?,
          status = ?, updated_at = ${NOW} WHERE id = ? AND worker_lease_hash = ?`,
        )
        .bind(message, nextRetryAt, status, candidateId, leaseHash)
        .run();
      return { status };
    },

    async listCategories() {
      const { results } = await database
        .prepare('SELECT name, title FROM navigation_category WHERE del_flag = 0')
        .all<{ name: string; title: string | null }>();
      return results;
    },
  };
}
