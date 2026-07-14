import config from "../config/index.js";
import BaseRepository from "./BaseRepository.js";

export default class UrlRepository extends BaseRepository {
  /**
   * shortUrl is derived, not stored. The old schema persisted the full short URL
   * on every row, so moving the app to a new domain silently broke every link
   * ever created. Deriving it from config means BASE_URL is the single source of
   * truth.
   */
  toDomain(row) {
    return {
      id: row.id,
      urlCode: row.url_code,
      longUrl: row.long_url,
      shortUrl: `${config.baseUrl}/${row.url_code}`,
      clickCount: row.click_count,
      userId: row.user_id ?? null,
      createdAt: row.created_at,
    };
  }

  findByCode(urlCode) {
    return this.one(`SELECT * FROM urls WHERE url_code = $1`, [urlCode]);
  }

  codeExists(urlCode) {
    return this.query(`SELECT 1 FROM urls WHERE url_code = $1`, [urlCode]).then(
      ({ rowCount }) => rowCount > 0,
    );
  }

  /**
   * `user_id = $2` never matches when $2 is NULL (NULL = NULL is NULL in SQL),
   * so anonymous lookups need IS NOT DISTINCT FROM. Getting this wrong would
   * mint a fresh code for every anonymous paste of the same URL.
   */
  findByLongUrlAndUser(longUrl, userId) {
    return this.one(
      `SELECT * FROM urls WHERE long_url = $1 AND user_id IS NOT DISTINCT FROM $2`,
      [longUrl, userId],
    );
  }

  create({ urlCode, longUrl, userId = null }) {
    return this.one(
      `INSERT INTO urls (url_code, long_url, user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [urlCode, longUrl, userId],
    );
  }

  /**
   * One page of a user's links, newest first.
   *
   * KEYSET pagination, not OFFSET. Offset is the obvious choice and it is wrong
   * twice over:
   *
   *   - It is O(n). `OFFSET 10000` makes Postgres walk and discard ten thousand
   *     rows before returning any, so deep pages get slower and slower.
   *   - It is *unstable*. Create a link while someone is on page 2 and every row
   *     shifts down one — they see a row twice, or never see one at all.
   *
   * Comparing the (created_at, id) tuple against the last row seen is O(log n) on
   * the index, and immune to inserts: the cursor names a *position in the data*,
   * not a count of rows.
   *
   * id is the tiebreak — two links created in the same millisecond would
   * otherwise have no stable order, and a page boundary between them would drop
   * or duplicate one.
   */
  findByUser(userId, { limit = 20, cursor = null } = {}) {
    if (cursor) {
      return this.many(
        `SELECT * FROM urls
          WHERE user_id = $1
            AND (created_at, id) < ($2::timestamptz, $3::uuid)
          ORDER BY created_at DESC, id DESC
          LIMIT $4`,
        [userId, cursor.createdAt, cursor.id, limit],
      );
    }

    return this.many(
      `SELECT * FROM urls
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [userId, limit],
    );
  }

  /**
   * Deletes a link, but only if it belongs to this user.
   *
   * The ownership check is in the WHERE clause, not a separate SELECT before the
   * DELETE. Two reasons, and the second is the one that matters:
   *
   *   - one round trip instead of two
   *   - no TOCTOU gap. A check-then-delete can have the row change owner (or be
   *     deleted) between the two statements. Here the database decides both
   *     questions in the same statement, atomically.
   *
   * Returns the deleted row so the caller can evict it from the cache — a link
   * that is gone from Postgres but still cached would keep redirecting.
   */
  deleteForUser(urlCode, userId) {
    return this.one(
      `DELETE FROM urls WHERE url_code = $1 AND user_id = $2 RETURNING *`,
      [urlCode, userId],
    );
  }

  /** Repoints a link. Same ownership-in-the-WHERE reasoning as delete. */
  updateLongUrlForUser(urlCode, userId, longUrl) {
    return this.one(
      `UPDATE urls
          SET long_url = $3, updated_at = now()
        WHERE url_code = $1 AND user_id = $2
      RETURNING *`,
      [urlCode, userId, longUrl],
    );
  }

  /**
   * A single atomic UPDATE. The old code did read → `clickCount++` → save, so two
   * concurrent clicks both read the same value and one increment was lost.
   */
  async incrementClickCount(urlId) {
    const { rows } = await this.query(
      `UPDATE urls SET click_count = click_count + 1 WHERE id = $1 RETURNING click_count`,
      [urlId],
    );
    return rows[0]?.click_count ?? null;
  }

  /**
   * The user's busiest links.
   *
   * In SQL, and not by sorting in Node — which is what the analytics service used
   * to do, over every link the user had ever created. That was already wasteful;
   * once findByUser became paginated it was also *wrong*, because it would have
   * been picking the top five out of whichever twenty rows happened to come back.
   */
  topLinksForUser(userId, limit = 5) {
    return this.many(
      `SELECT * FROM urls
        WHERE user_id = $1
        ORDER BY click_count DESC, created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
  }

  async statsForUser(userId) {
    const { rows } = await this.query(
      `SELECT count(*)::bigint                     AS total_links,
              coalesce(sum(click_count), 0)::bigint AS total_clicks
         FROM urls WHERE user_id = $1`,
      [userId],
    );
    return {
      totalLinks: rows[0].total_links,
      totalClicks: rows[0].total_clicks,
    };
  }
}
