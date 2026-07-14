-- 001_init — users, urls, clicks.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Emails are compared case-insensitively; a functional index enforces that
-- without needing the citext extension (not available on every hosted PG).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));


CREATE TABLE IF NOT EXISTS urls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_code    TEXT        NOT NULL,
  long_url    TEXT        NOT NULL,
  user_id     UUID        REFERENCES users (id) ON DELETE CASCADE,
  click_count BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The short code is the redirect key. Without this, two users could be handed
-- the same generated code and one of them would redirect to the wrong site.
CREATE UNIQUE INDEX IF NOT EXISTS urls_url_code_key ON urls (url_code);

-- "The same long URL can be shortened once per user." Postgres treats NULLs as
-- distinct in a unique index, so a plain (long_url, user_id) index would let
-- anonymous users create unlimited duplicates of the same long URL. Two partial
-- indexes give the intended behaviour for both cases.
CREATE UNIQUE INDEX IF NOT EXISTS urls_long_url_user_key
  ON urls (long_url, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS urls_long_url_anon_key
  ON urls (long_url) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS urls_user_created_idx ON urls (user_id, created_at DESC);


-- Clicks live in their own table rather than an array on the url row: an
-- unbounded array grows the row on every click and eventually hits Postgres'
-- tuple limits, and it can't be aggregated in SQL without unnesting.
CREATE TABLE IF NOT EXISTS clicks (
  id         BIGSERIAL PRIMARY KEY,
  url_id     UUID        NOT NULL REFERENCES urls (id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  referer    TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS clicks_url_time_idx ON clicks (url_id, clicked_at DESC);
