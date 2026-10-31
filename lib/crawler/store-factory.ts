import type { D1DatabaseClient } from '../../db/d1';

export type CrawlCandidate = {
  attempt_count: number;
  canonical_url: string;
  category_name: string | null;
  description: string | null;
  detail: string | null;
  domain: string;
  id: number;
  image_url: string | null;
  source: string;
  source_item_id: string | null;
  status: string;
  title: string | null;
  url: string;
};

export type CandidateInput = {
  canonical_url: string;
  domain: string;
  source: string;
  source_item_id: string | null;
  source_url: string | null;
  url: string;
};

export type CandidateReview = {
  canonicalUrl: string;
  categoryName: string | null;
  description: string;
  detail: string;
  imageUrl: string | null;
  title: string;
};

export type ReviewResult = { categoryName?: string; name?: string; status: 'pending' | 'published' | 'rejected' };

export type ReviewQueueCandidate = {
  canonical_url: string;
  category_name: string | null;
  description: string | null;
  domain: string;
  has_detail: number;
  id: number;
  image_url: string | null;
  source: string;
  source_url: string | null;
  title: string | null;
  updated_at: string;
};

export interface CrawlerStore {
  claimCandidates(limit: number): Promise<CrawlCandidate[]>;
  getReviewCandidateDetail(id: number): Promise<{ detail: string | null } | null>;
  listCategories(): Promise<Array<{ name: string; title: string | null }>>;
  listPendingSubmissions(): Promise<Array<{ id: number; url: string | null }>>;
  listReviewCandidates(offset: number, limit: number): Promise<{ items: ReviewQueueCandidate[]; total: number }>;
  markCandidateFailed(candidate: CrawlCandidate, message: string): Promise<'retry' | 'failed'>;
  publishCandidate(
    id: number,
    review: CandidateReview,
  ): Promise<{ categoryName: string; name: string; status: 'published' }>;
  reviewCandidate(id: number, action: 'approve' | 'reject' | 'rewrite', categoryName?: string): Promise<ReviewResult>;
  upsertCandidates(rows: CandidateInput[]): Promise<void>;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const CLAIMABLE = `(status = 'pending'
  OR (status = 'retry' AND COALESCE(next_retry_at, ${NOW}) <= ${NOW})
  OR (status = 'processing' AND (
    (worker_lease_expires_at IS NOT NULL AND worker_lease_expires_at < ${NOW})
    OR (worker_lease_expires_at IS NULL AND locked_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes'))
  )))`;

function publicationName(candidate: CrawlCandidate) {
  const baseName = candidate.domain
    .replace(/^www\./, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${baseName}-${candidate.id}`;
}

async function activeCategory(database: D1DatabaseClient, name: string) {
  return database
    .prepare('SELECT name FROM navigation_category WHERE name = ? AND del_flag = 0 LIMIT 1')
    .bind(name)
    .first<{ name: string }>();
}

async function publish(
  database: D1DatabaseClient,
  candidate: CrawlCandidate,
  review: CandidateReview,
  requiredStatus: 'processing' | 'review',
) {
  const categoryName = review.categoryName || 'other';
  if (!(await activeCategory(database, categoryName))) throw new Error('invalid_category');
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
        review.title,
        review.description,
        review.detail,
        review.canonicalUrl,
        review.imageUrl,
        review.imageUrl,
        categoryName,
        categoryName,
      ),
    database
      .prepare(
        `UPDATE crawler_candidate
        SET canonical_url = ?, category_name = ?, description = ?, detail = ?, error_message = NULL,
            image_url = ?, locked_at = NULL, next_retry_at = NULL, worker_lease_hash = NULL,
            worker_lease_expires_at = NULL, status = 'published', title = ?, updated_at = ${NOW}
        WHERE id = ? AND status = ?`,
      )
      .bind(
        review.canonicalUrl,
        categoryName,
        review.description,
        review.detail,
        review.imageUrl,
        review.title,
        candidate.id,
        requiredStatus,
      ),
  ];
  if (candidate.source === 'submission' && candidate.source_item_id) {
    statements.push(database.prepare('UPDATE submit SET status = 1 WHERE id = ?').bind(candidate.source_item_id));
  }
  const results = await database.batch(statements);
  if (!results[1].success || Number(results[1].meta.changes || 0) !== 1) throw new Error('candidate_not_publishable');
  return { categoryName, name, status: 'published' as const };
}

export default function createCrawlerStore(database: D1DatabaseClient): CrawlerStore {
  return {
    async claimCandidates(limit) {
      const safeLimit = Math.max(1, Math.min(limit, 20));
      const { results: rows } = await database
        .prepare(`SELECT id FROM crawler_candidate WHERE ${CLAIMABLE} ORDER BY discovered_at ASC LIMIT ?`)
        .bind(safeLimit)
        .all<{ id: number }>();
      const candidates = await Promise.all(
        rows.map((row) =>
          database
            .prepare(
              `UPDATE crawler_candidate
              SET status = 'processing', locked_at = ${NOW}, attempt_count = attempt_count + 1,
                  worker_lease_hash = NULL, worker_lease_expires_at = NULL,
                  updated_at = ${NOW}, error_message = NULL
              WHERE id = ? AND ${CLAIMABLE} RETURNING *`,
            )
            .bind(row.id)
            .first<CrawlCandidate>(),
        ),
      );
      return candidates.filter((candidate): candidate is CrawlCandidate => Boolean(candidate));
    },

    async getReviewCandidateDetail(id) {
      return database
        .prepare("SELECT detail FROM crawler_candidate WHERE id = ? AND status = 'review'")
        .bind(id)
        .first<{ detail: string | null }>();
    },

    async listCategories() {
      const { results } = await database
        .prepare('SELECT name, title FROM navigation_category WHERE del_flag = 0')
        .all<{ name: string; title: string | null }>();
      return results;
    },

    async listPendingSubmissions() {
      const { results } = await database
        .prepare(
          `SELECT id, url FROM submit WHERE status = 0
          ORDER BY is_feature DESC, created_at ASC LIMIT 50`,
        )
        .all<{ id: number; url: string | null }>();
      return results;
    },

    async listReviewCandidates(offset, limit) {
      const safeOffset = Math.max(0, offset);
      const safeLimit = Math.max(1, Math.min(limit, 50));
      const [itemsResult, countResult] = await database.batch([
        database
          .prepare(
            `SELECT id, canonical_url, domain, source, source_url, title, description,
              image_url, category_name, updated_at, detail IS NOT NULL AS has_detail
            FROM crawler_candidate WHERE status = 'review'
            ORDER BY updated_at ASC, id ASC LIMIT ? OFFSET ?`,
          )
          .bind(safeLimit, safeOffset),
        database.prepare("SELECT COUNT(*) AS count FROM crawler_candidate WHERE status = 'review'"),
      ]);
      return {
        items: itemsResult.results as unknown as ReviewQueueCandidate[],
        total: Number((countResult.results[0] as { count?: number } | undefined)?.count || 0),
      };
    },

    async markCandidateFailed(candidate, message) {
      const retry = candidate.attempt_count < 3;
      const status = retry ? 'retry' : 'failed';
      const nextRetryAt = retry
        ? new Date(Date.now() + 2 ** candidate.attempt_count * 15 * 60 * 1000).toISOString()
        : null;
      await database
        .prepare(
          `UPDATE crawler_candidate
          SET error_message = ?, locked_at = NULL, next_retry_at = ?, status = ?, updated_at = ${NOW}
          WHERE id = ?`,
        )
        .bind(message, nextRetryAt, status, candidate.id)
        .run();
      return status;
    },

    async publishCandidate(id, review) {
      const candidate = await database
        .prepare("SELECT * FROM crawler_candidate WHERE id = ? AND status = 'processing'")
        .bind(id)
        .first<CrawlCandidate>();
      if (!candidate) throw new Error('candidate_not_publishable');
      return publish(database, candidate, review, 'processing');
    },

    async reviewCandidate(id, action, categoryOverride) {
      const candidate = await database
        .prepare("SELECT * FROM crawler_candidate WHERE id = ? AND status = 'review'")
        .bind(id)
        .first<CrawlCandidate>();
      if (!candidate) throw new Error('candidate_not_reviewable');
      if (action === 'rewrite') {
        await database
          .prepare(
            `UPDATE crawler_candidate SET status = 'pending', attempt_count = 0, error_message = NULL,
            locked_at = NULL, next_retry_at = NULL, worker_lease_hash = NULL,
            worker_lease_expires_at = NULL, updated_at = ${NOW} WHERE id = ? AND status = 'review'`,
          )
          .bind(id)
          .run();
        return { status: 'pending' as const };
      }
      if (action === 'reject') {
        const statements = [
          database
            .prepare(
              `UPDATE crawler_candidate SET status = 'rejected', worker_lease_hash = NULL,
              worker_lease_expires_at = NULL, updated_at = ${NOW} WHERE id = ? AND status = 'review'`,
            )
            .bind(id),
        ];
        if (candidate.source === 'submission' && candidate.source_item_id) {
          statements.push(database.prepare('UPDATE submit SET status = 2 WHERE id = ?').bind(candidate.source_item_id));
        }
        await database.batch(statements);
        return { status: 'rejected' as const };
      }
      if (!candidate.title || !candidate.description || !candidate.detail) {
        throw new Error('candidate_content_incomplete');
      }
      return publish(
        database,
        candidate,
        {
          canonicalUrl: candidate.canonical_url,
          categoryName: categoryOverride || candidate.category_name,
          description: candidate.description,
          detail: candidate.detail,
          imageUrl: candidate.image_url,
          title: candidate.title,
        },
        'review',
      );
    },

    async upsertCandidates(rows) {
      if (!rows.length) return;
      await database.batch(
        rows.map((row) =>
          database
            .prepare(
              `INSERT INTO crawler_candidate
              (canonical_url, domain, source, source_item_id, source_url, url)
              VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(canonical_url) DO NOTHING`,
            )
            .bind(row.canonical_url, row.domain, row.source, row.source_item_id, row.source_url, row.url),
        ),
      );
    },
  };
}
