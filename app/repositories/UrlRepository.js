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

  findByUser(userId) {
    return this.many(
      `SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
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
