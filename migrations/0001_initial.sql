PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS submit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  name TEXT,
  url TEXT,
  email TEXT,
  is_feature INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS navigation_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  title TEXT,
  sort INTEGER,
  del_flag INTEGER NOT NULL DEFAULT 0 CHECK (del_flag IN (0, 1)),
  create_by INTEGER NOT NULL DEFAULT 0,
  create_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS web_navigation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT,
  detail TEXT,
  url TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  website_data TEXT,
  collection_time TEXT,
  star_rating INTEGER,
  tag_name TEXT,
  category_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS web_navigation_url_unique_idx
  ON web_navigation (url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS web_navigation_category_idx
  ON web_navigation (category_name, collection_time DESC);
CREATE INDEX IF NOT EXISTS submit_queue_idx
  ON submit (status, is_feature DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS crawler_candidate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  source TEXT NOT NULL,
  source_item_id TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'review', 'published', 'retry', 'failed', 'rejected')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  locked_at TEXT,
  worker_lease_hash TEXT,
  worker_lease_expires_at TEXT,
  title TEXT,
  description TEXT,
  detail TEXT,
  image_url TEXT,
  category_name TEXT,
  error_message TEXT,
  discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS crawler_candidate_claimable_idx
  ON crawler_candidate (status, next_retry_at, discovered_at)
  WHERE status IN ('pending', 'retry', 'processing');
CREATE INDEX IF NOT EXISTS crawler_candidate_source_item_idx
  ON crawler_candidate (source, source_item_id) WHERE source_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crawler_candidate_review_idx
  ON crawler_candidate (updated_at, id) WHERE status = 'review';
CREATE INDEX IF NOT EXISTS crawler_candidate_worker_lease_idx
  ON crawler_candidate (worker_lease_expires_at)
  WHERE status = 'processing' AND worker_lease_expires_at IS NOT NULL;
