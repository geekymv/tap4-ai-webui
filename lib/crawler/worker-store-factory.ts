import { createHash, randomBytes } from 'node:crypto';
import { Sql } from 'postgres';

import { CrawlCandidate } from './store-factory';
import { WorkerResultInput } from './worker-contract';

const LEASE_MINUTES = 20;

type WorkerCandidate = CrawlCandidate & { leaseToken: string };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export interface CrawlerWorkerStore {
  claim(limit: number): Promise<WorkerCandidate[]>;
  complete(input: WorkerResultInput): Promise<{ status: 'review' }>;
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
        if (input.categoryName) {
          const [category] = await transaction<Array<{ name: string }>>`
            select name from navigation_category where name = ${input.categoryName} and del_flag = 0
          `;
          if (!category) throw new Error('invalid_category');
        }
        const leaseHash = hashToken(input.leaseToken);
        const [updated] = await transaction<Array<{ id: number }>>`
          update crawler.candidate
          set canonical_url = ${input.canonicalUrl}, category_name = ${input.categoryName},
              description = ${input.description}, detail = ${input.detail}, error_message = null,
              image_url = ${input.imageUrl}, locked_at = null, next_retry_at = null,
              status = 'review', title = ${input.title}, updated_at = now()
          where id = ${input.candidateId} and status = 'processing'
            and worker_lease_hash = ${leaseHash} and worker_lease_expires_at > now()
          returning id
        `;
        if (updated) return { status: 'review' as const };
        const [completed] = await transaction<Array<{ id: number }>>`
          select id from crawler.candidate
          where id = ${input.candidateId} and status = 'review' and worker_lease_hash = ${leaseHash}
        `;
        if (completed) return { status: 'review' as const };
        throw new Error('invalid_or_expired_lease');
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
