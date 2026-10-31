## Cloudflare Workers / D1 migration

The application now runs through OpenNext Cloudflare and uses the `DB` D1 binding. Supabase and the PostgreSQL runtime
driver are no longer required. `migrations/0001_initial.sql` contains the SQLite/D1 schema, including the crawler tables
and indexes.

No production database is changed by this repository migration. Keep Supabase read-only until row counts and sampled
records have been verified and traffic has been switched successfully.

### 1. Provision Cloudflare resources

1. Create the database: `pnpm wrangler d1 create getaitools`.
2. Create the ISR cache bucket: `pnpm wrangler r2 bucket create getaitools-cache`.
3. Put the returned database ID in `wrangler.jsonc` in place of `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`.
4. Apply the schema locally first: `pnpm db:migrate:local`.
5. Apply it remotely only after review: `pnpm db:migrate:remote`.
6. Configure Worker variables/secrets from `.env.example`. Secrets such as `CRON_SECRET`, `REVIEW_AUTH_KEY`, and
   `CRAWLER_WORKER_KEY` must use `wrangler secret put`; never commit their values.

The Worker cron calls `/api/cron/discover` daily. It requires `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET` in the Worker
environment.

### 2. Export Supabase/PostgreSQL safely

Run the following against a read-only connection. Store exports outside the repository and use `NULL '\N'` so SQL NULL
remains distinguishable from an empty string.

```sql
\copy (SELECT * FROM public.navigation_category ORDER BY id) TO 'navigation_category.csv' CSV HEADER NULL '\N'
\copy (SELECT * FROM public.web_navigation ORDER BY id) TO 'web_navigation.csv' CSV HEADER NULL '\N'
\copy (SELECT * FROM public.submit ORDER BY id) TO 'submit.csv' CSV HEADER NULL '\N'
\copy (SELECT id, url, canonical_url, domain, source, source_item_id, source_url, status, attempt_count, next_retry_at, locked_at, worker_lease_hash, worker_lease_expires_at, title, description, detail, image_url, category_name, error_message, discovered_at, created_at, updated_at FROM crawler.candidate ORDER BY id) TO 'crawler_candidate.csv' CSV HEADER NULL '\N'
```

Convert the trusted exports to D1-compatible SQL, then import into a newly created, empty non-production D1 database
first. The generated plain `INSERT` statements intentionally fail on conflicts rather than overwriting existing rows:

```bash
python3 scripts/convert-postgres-export-to-d1.py ./private-export ./private-export/import.sql
pnpm wrangler d1 execute getaitools --local --file ./private-export/import.sql
# After validation and an approved maintenance window only:
pnpm wrangler d1 execute getaitools --remote --file ./private-export/import.sql
```

The converter only accepts the known table columns. Do not use untrusted CSV files.

### 3. Validate before cutover

Compare counts in both databases:

```bash
pnpm wrangler d1 execute getaitools --remote --command "SELECT 'navigation_category' AS name, COUNT(*) AS rows FROM navigation_category UNION ALL SELECT 'web_navigation', COUNT(*) FROM web_navigation UNION ALL SELECT 'submit', COUNT(*) FROM submit UNION ALL SELECT 'crawler_candidate', COUNT(*) FROM crawler_candidate"
```

Also sample records containing Unicode, apostrophes, multiline Markdown, nullable images, and timestamps. In a preview
deployment verify:

- home, search, category pagination, tool detail, sitemap, and submission;
- crawler discovery, claim, completion/failure, review approval/rejection, and cron authentication;
- Worker logs show no missing `DB` binding or failed scheduled request.

### 4. Cutover and rollback

Pause writes to Supabase, take a final export, import it into D1, re-run counts/samples, then route traffic to the
Cloudflare Worker. Keep Supabase unchanged during the rollback window. Rollback consists of routing traffic back to the
previous deployment; do not attempt reverse synchronization without a separately reviewed plan.
