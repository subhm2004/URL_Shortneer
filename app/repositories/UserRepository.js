import BaseRepository from "./BaseRepository.js";

export default class UserRepository extends BaseRepository {
  /**
   * password_hash is deliberately absent — it is only ever selected by
   * findByEmailWithPassword(), so it cannot leak into an API response by
   * accident (the old Mongoose model relied on `select: false` for this).
   */
  toDomain(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      ...(row.password_hash ? { passwordHash: row.password_hash } : {}),
    };
  }

  findById(id) {
    return this.one(
      `SELECT id, name, email, created_at FROM users WHERE id = $1`,
      [id],
    );
  }

  findByEmail(email) {
    return this.one(
      `SELECT id, name, email, created_at FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
  }

  /** The only path that reads the hash — used by login, nothing else. */
  findByEmailWithPassword(email) {
    return this.one(
      `SELECT id, name, email, password_hash, created_at
         FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
  }

  create({ name, email, passwordHash }) {
    return this.one(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, lower($2), $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash],
    );
  }
}
