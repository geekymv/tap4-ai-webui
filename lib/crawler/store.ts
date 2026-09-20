import getDatabase from '@/db/postgres';
import { Sql } from 'postgres';

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

export type ReviewResult = { categoryName?: string; name?: string; status: 'published' | 'rejected' };

export interface CrawlerStore {
  claimCandidates(limit: number): Promise<CrawlCandidate[]>;
  listCategories(): Promise<Array<{ name: string; title: string | null }>>;
  listPendingSubmissions(): Promise<Array<{ id: number; url: string | null }>>;
  markCandidateFailed(candidate: CrawlCandidate, message: string): Promise<'retry' | 'failed'>;
  markCandidateReview(id: number, review: CandidateReview): Promise<void>;
  reviewCandidate(id: number, action: 'approve' | 'reject', categoryName?: string): Promise<ReviewResult>;
  upsertCandidates(rows: CandidateInput[]): Promise<void>;
}

export default function createCrawlerStore(sql: Sql = getDatabase()): CrawlerStore {
  return {
    async claimCandidates(limit) {
      return sql<CrawlCandidate[]>`
        with picked as (
          select id
          from crawler.candidate
          where status = 'pending'
             or (status = 'retry' and coalesce(next_retry_at, now()) <= now())
             or (status = 'processing' and locked_at < now() - interval '15 minutes')
          order by discovered_at asc
          limit ${Math.max(1, Math.min(limit, 20))}
          for update skip locked
        )
        update crawler.candidate as candidate
        set status = 'processing', locked_at = now(),
            attempt_count = candidate.attempt_count + 1,
            updated_at = now(), error_message = null
        from picked
        where candidate.id = picked.id
        returning candidate.*
      `;
    },

    async listCategories() {
      return sql<Array<{ name: string; title: string | null }>>`
        select name, title from navigation_category where del_flag = 0
      `;
    },

    async listPendingSubmissions() {
      return sql<Array<{ id: number; url: string | null }>>`
        select id, url from submit
        where status = 0
        order by is_feature desc, created_at asc
        limit 50
      `;
    },

    async markCandidateFailed(candidate, message) {
      const retry = candidate.attempt_count < 3;
      const status = retry ? 'retry' : 'failed';
      const nextRetryAt = retry ? new Date(Date.now() + 2 ** candidate.attempt_count * 15 * 60 * 1000) : null;
      await sql`
        update crawler.candidate
        set error_message = ${message}, locked_at = null, next_retry_at = ${nextRetryAt},
            status = ${status}, updated_at = now()
        where id = ${candidate.id}
      `;
      return status;
    },

    async markCandidateReview(id, review) {
      await sql`
        update crawler.candidate
        set canonical_url = ${review.canonicalUrl}, category_name = ${review.categoryName},
            description = ${review.description}, detail = ${review.detail}, error_message = null,
            image_url = ${review.imageUrl}, locked_at = null, next_retry_at = null,
            status = 'review', title = ${review.title}, updated_at = now()
        where id = ${id}
      `;
    },

    async reviewCandidate(id, action, categoryOverride) {
      return sql.begin(async (transaction) => {
        const [candidate] = await transaction<CrawlCandidate[]>`
          select * from crawler.candidate where id = ${id} and status = 'review' for update
        `;
        if (!candidate) throw new Error('candidate_not_reviewable');
        if (action === 'reject') {
          await transaction`update crawler.candidate set status = 'rejected', updated_at = now() where id = ${id}`;
          if (candidate.source === 'submission' && candidate.source_item_id) {
            await transaction`update submit set status = 2 where id = ${candidate.source_item_id}`;
          }
          return { status: 'rejected' as const };
        }
        if (!candidate.title || !candidate.description || !candidate.detail) {
          throw new Error('candidate_content_incomplete');
        }
        const categoryName = categoryOverride || candidate.category_name || 'other';
        const baseName = candidate.domain
          .replace(/^www\./, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const proposedName = `${baseName}-${candidate.id}`;
        const [published] = await transaction<Array<{ name: string }>>`
          insert into web_navigation (
            name, title, content, detail, url, image_url, thumbnail_url,
            collection_time, tag_name, category_name
          ) values (
            ${proposedName}, ${candidate.title}, ${candidate.description}, ${candidate.detail},
            ${candidate.canonical_url}, ${candidate.image_url}, ${candidate.image_url},
            now(), ${categoryName}, ${categoryName}
          )
          on conflict (url) where url is not null do update set
            title = excluded.title, content = excluded.content, detail = excluded.detail,
            image_url = excluded.image_url, thumbnail_url = excluded.thumbnail_url,
            collection_time = excluded.collection_time, tag_name = excluded.tag_name,
            category_name = excluded.category_name
          returning name
        `;
        await transaction`update crawler.candidate set status = 'published', updated_at = now() where id = ${id}`;
        if (candidate.source === 'submission' && candidate.source_item_id) {
          await transaction`update submit set status = 1 where id = ${candidate.source_item_id}`;
        }
        return { categoryName, name: published.name, status: 'published' as const };
      });
    },

    async upsertCandidates(rows) {
      if (!rows.length) return;
      const values = sql(rows, 'canonical_url', 'domain', 'source', 'source_item_id', 'source_url', 'url');
      await sql`
        insert into crawler.candidate ${values}
        on conflict (canonical_url) do nothing
      `;
    },
  };
}
