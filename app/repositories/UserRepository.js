import BaseRepository from "./BaseRepository.js";

export default class UserRepository extends BaseRepository {
  /**
   * password_hash is deliberately absent from the default projection — it is
   * only ever selected by findByEmailWithPassword(), so it cannot leak into an
   * API response by accident.
   */
  toDomain(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url ?? null,
      /** True for a Google account. Lets the UI say "signed in with Google". */
      hasGoogle: Boolean(row.google_id),
      createdAt: row.created_at,
      ...(row.password_hash ? { passwordHash: row.password_hash } : {}),
    };
  }

  findById(id) {
    return this.one(
      `SELECT id, name, email, avatar_url, google_id, created_at
         FROM users WHERE id = $1`,
      [id],
    );
  }

  findByEmail(email) {
    return this.one(
      `SELECT id, name, email, avatar_url, google_id, created_at
         FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
  }

  /**
   * The only path that reads the hash — used by login, nothing else.
   *
   * password_hash comes back NULL for a Google-only account. The caller must
   * handle that: bcrypt.compare(password, null) throws rather than returning
   * false, so a missing hash is not "wrong password", it's "no password set".
   */
  findByEmailWithPassword(email) {
    return this.one(
      `SELECT id, name, email, password_hash, avatar_url, google_id, created_at
         FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
  }

  /**
   * Keyed on Google's `sub`, never on the email — a Google user can change their
   * email address, and keying on it would either lose them their account or hand
   * it to whoever later picks up their old address.
   */
  findByGoogleId(googleId) {
    return this.one(
      `SELECT id, name, email, avatar_url, google_id, created_at
         FROM users WHERE google_id = $1`,
      [googleId],
    );
  }

  create({ name, email, passwordHash }) {
    return this.one(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, lower($2), $3)
       RETURNING id, name, email, avatar_url, google_id, created_at`,
      [name, email, passwordHash],
    );
  }

  /** A brand-new account that has no password and never will. */
  createFromGoogle({ name, email, googleId, avatarUrl }) {
    return this.one(
      `INSERT INTO users (name, email, google_id, avatar_url, password_hash)
       VALUES ($1, lower($2), $3, $4, NULL)
       RETURNING id, name, email, avatar_url, google_id, created_at`,
      [name, email, googleId, avatarUrl],
    );
  }

  /**
   * Attaches Google to an account that already signed up with a password.
   * The existing password keeps working — this adds a way in, it doesn't
   * replace one.
   */
  linkGoogle(userId, { googleId, avatarUrl }) {
    return this.one(
      `UPDATE users
          SET google_id = $2,
              avatar_url = COALESCE(avatar_url, $3),
              updated_at = now()
        WHERE id = $1
      RETURNING id, name, email, avatar_url, google_id, created_at`,
      [userId, googleId, avatarUrl],
    );
  }
}
