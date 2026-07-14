import { getPool } from "../db/pool.js";

/**
 * Template Method — subclasses declare *what* table and *how* to map a row, and
 * inherit the query/transaction plumbing. Every concrete repository gets the
 * same connection handling for free and none of them import `pg` directly.
 */
export default class BaseRepository {
  /** @param {import("pg").Pool | import("pg").PoolClient} [executor] */
  constructor(executor) {
    this._executor = executor ?? null;
  }

  /** Overridden by subclasses to turn a snake_case DB row into a domain object. */
  // eslint-disable-next-line class-methods-use-this
  toDomain(row) {
    return row;
  }

  get executor() {
    return this._executor ?? getPool();
  }

  async query(text, params = []) {
    return this.executor.query(text, params);
  }

  /** Rows mapped through toDomain(). */
  async many(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows.map((row) => this.toDomain(row));
  }

  /** First row mapped through toDomain(), or null. */
  async one(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  /**
   * Runs `fn` inside a transaction on a dedicated client, handing it a
   * repository of the same type bound to that client — so the caller can compose
   * several writes atomically without leaking connection management upward.
   */
  async withTransaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const scoped = new this.constructor(client);
      const result = await fn(scoped, client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

/** Postgres unique-violation code — surfaced so services can map it to a 409. */
export const UNIQUE_VIOLATION = "23505";
