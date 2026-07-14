-- 002_google_oauth — let a user exist without a password.

-- A Google user never sets one. The column was NOT NULL, which made such a row
-- impossible to insert at all.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google's `sub` claim: the stable, unique id for the account. It is the thing
-- to key on, NOT the email — a Google user can change their email address, and
-- keying on email would then either lose them their account or, worse, hand it
-- to whoever picked up their old address.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key
  ON users (google_id) WHERE google_id IS NOT NULL;

-- Belt and braces: every row must be reachable by *some* credential. Without
-- this, a bug that dropped both a password and a google_id would leave behind an
-- account nobody — including its owner — could ever sign in to.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_has_a_credential;
ALTER TABLE users ADD CONSTRAINT users_has_a_credential
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);
