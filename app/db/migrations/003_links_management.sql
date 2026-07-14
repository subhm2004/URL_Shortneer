-- 003_links_management — keyset pagination + tracking edits.

-- Keyset ("cursor") pagination orders by (created_at, id) and asks Postgres for
-- rows strictly after the last one seen. The existing index stops at created_at,
-- so the id half of that comparison was a sort. This covers the whole key.
--
-- id is the tiebreak: two links created in the same millisecond would otherwise
-- have no stable order, and a page boundary landing between them would either
-- skip one or show it twice.
DROP INDEX IF EXISTS urls_user_created_idx;
CREATE INDEX IF NOT EXISTS urls_user_keyset_idx
  ON urls (user_id, created_at DESC, id DESC);

-- A link's destination can now be changed, so "when was it last touched" stops
-- being the same question as "when was it created".
ALTER TABLE urls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
