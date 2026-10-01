import { createHash, randomBytes } from 'node:crypto';
import { Sql } from 'postgres';

import { normalizeUrl } from './normalize';
import { CrawlCandidate } from './store-factory';
import { haveSameHttpHost, WorkerResultInput } from './worker-contract';

const LEASE_MINUTES = 20;

type WorkerCandidate = CrawlCandidate & { leaseToken: string };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export interface CrawlerWorkerStore {
  claim(limit: number): Promise<WorkerCandidate[]>;
  complete(input: WorkerResultInput): Promise<{ categoryName: string; name: string; status: 'published' }>;
  fail(candidateId: number, leaseToken: string, message: string): Promise<{ status: 'failed' | 'retry' }>;
  listCategories(): Promise<Array<{ name: string; title: string | null }>>;
}

export default function createCrawlerWorkerStore(sql: Sql): CrawlerWorkerStore {
  return {
    async claim(limit) {
      return sql.begin(async (transaction) => {
        const candidates = await transaction<CrawlCandidate[]>`
          select * from crawler.candidate
          where status = 'pending'
             or (status = 'retry' and coalesce(next_retry_at, now()) <= now())
             or (
               status = 'processing' and (
                 (worker_lease_expires_at is not null and worker_lease_expires_at < now())
                 or (worker_lease_expires_at is null and locked_at < now() - interval '15 minutes')
               )
             )
          order by discovered_at asc
          limit ${Math.max(1, Math.min(limit, 5))}
          for update skip locked
        `;
        return Promise.all(
          candidates.map(async (candidate) => {
            const leaseToken = randomBytes(32).toString('base64url');
            const leaseHash = hashToken(leaseToken);
            const [updated] = await transaction<CrawlCandidate[]>`
              update crawler.candidate
              set status = 'processing', locked_at = now(), attempt_count = attempt_count + 1,
                  worker_lease_hash = ${leaseHash},
                  worker_lease_expires_at = now() + ${LEASE_MINUTES} * interval '1 minute',
                  error_message = null, updated_at = now()
              where id = ${candidate.id}
              returning *
            `;
            return { ...updated, leaseToken };
          }),
        );
      });
    },

    async complete(input) {
      return sql.begin(async (transaction) => {
        const leaseHash = hashToken(input.leaseToken);
        const [candidate] = await transaction<CrawlCandidate[]>`
          select * from crawler.candidate
          where id = ${input.candidateId} and status = 'processing'
            and worker_lease_hash = ${leaseHash} and worker_lease_expires_at > now()
          for update
        `;
        if (!candidate) {
          const [completed] = await transaction<Array<{ canonical_url: string; category_name: string }>>`
            select canonical_url, category_name from crawler.candidate
            where id = ${input.candidateId} and status = 'published' and worker_lease_hash = ${leaseHash}
          `;
          if (completed) {
            const [published] = await transaction<Array<{ name: string }>>`
              select name from web_navigation where url = ${completed.canonical_url}
            `;
            if (!published) throw new Error('published_navigation_missing');
            return { categoryName: completed.category_name, name: published.name, status: 'published' as const };
          }
          throw new Error('invalid_or_expired_lease');
        }
        const canonicalUrl = normalizeUrl(input.canonicalUrl);
        if (!haveSameHttpHost(candidate.url, canonicalUrl)) throw new Error('invalid_canonical_origin');
        if (input.imageUrl && !haveSameHttpHost(canonicalUrl, input.imageUrl)) {
          throw new Error('invalid_image_origin');
        }
        const categoryName = input.categoryName || 'other';
        const [category] = await transaction<Array<{ name: string }>>`
          select name from navigation_category where name = ${categoryName} and del_flag = 0
        `;
        if (!category) throw new Error('invalid_category');
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
            ${proposedName}, ${input.title}, ${input.description}, ${input.detail},
            ${canonicalUrl}, ${input.imageUrl}, ${input.imageUrl},
            now(), ${categoryName}, ${categoryName}
          )
          on conflict (url) where url is not null do update set
            title = excluded.title, content = excluded.content, detail = excluded.detail,
            image_url = excluded.image_url, thumbnail_url = excluded.thumbnail_url,
            collection_time = excluded.collection_time, tag_name = excluded.tag_name,
            category_name = excluded.category_name
          returning name
        `;
        await transaction`
          update crawler.candidate
          set canonical_url = ${canonicalUrl}, category_name = ${categoryName},
              description = ${input.description}, detail = ${input.detail}, error_message = null,
              image_url = ${input.imageUrl}, locked_at = null, next_retry_at = null,
              status = 'published', title = ${input.title}, updated_at = now()
          where id = ${input.candidateId}
        `;
        if (candidate.source === 'submission' && candidate.source_item_id) {
          await transaction`update submit set status = 1 where id = ${candidate.source_item_id}`;
        }
        return { categoryName, name: published.name, status: 'published' as const };
      });
    },

    async fail(candidateId, leaseToken, message) {
      return sql.begin(async (transaction) => {
        const leaseHash = hashToken(leaseToken);
        const [candidate] = await transaction<Array<{ attempt_count: number }>>`
          select attempt_count from crawler.candidate
          where id = ${candidateId} and status = 'processing'
            and worker_lease_hash = ${leaseHash} and worker_lease_expires_at > now()
          for update
        `;
        if (!candidate) {
          const [previous] = await transaction<Array<{ status: 'failed' | 'retry' }>>`
            select status from crawler.candidate
            where id = ${candidateId} and status in ('retry', 'failed') and worker_lease_hash = ${leaseHash}
          `;
          if (previous) return { status: previous.status };
          throw new Error('invalid_or_expired_lease');
        }
        const retry = candidate.attempt_count < 3;
        const status = retry ? 'retry' : 'failed';
        const nextRetryAt = retry ? new Date(Date.now() + 2 ** candidate.attempt_count * 15 * 60 * 1000) : null;
        await transaction`
          update crawler.candidate
          set error_message = ${message}, locked_at = null, next_retry_at = ${nextRetryAt},
              status = ${status}, updated_at = now()
          where id = ${candidateId}
        `;
        return { status };
      });
    },

    async listCategories() {
      return sql<Array<{ name: string; title: string | null }>>`
        select name, title from navigation_category where del_flag = 0
      `;
    },
  };
}
