import BaseRepository from "./BaseRepository.js";

export default class ClickRepository extends BaseRepository {
  record({ urlId, referer = null, userAgent = null }) {
    return this.query(
      `INSERT INTO clicks (url_id, referer, user_agent) VALUES ($1, $2, $3)`,
      [urlId, referer, userAgent?.slice(0, 512) ?? null],
    );
  }

  /**
   * Aggregation happens in Postgres, not Node. The previous implementation
   * loaded every URL row (with its full array of click timestamps) into memory
   * and counted them in a JS Map — O(total clicks ever) work and memory on every
   * dashboard load.
   *
   * generate_series produces the full date spine so days with zero clicks come
   * back as 0 rather than being missing, which is what the chart needs.
   */
  clicksByDayForUser(userId, days) {
    return this.query(
      `WITH spine AS (
         SELECT generate_series(
           (current_date - make_interval(days => $2::int - 1)),
           current_date,
           interval '1 day'
         )::date AS day
       )
       SELECT to_char(spine.day, 'YYYY-MM-DD') AS date,
              count(c.id)::bigint              AS count
         FROM spine
         LEFT JOIN urls u ON u.user_id = $1
         LEFT JOIN clicks c
                ON c.url_id = u.id
               AND c.clicked_at >= spine.day
               AND c.clicked_at <  spine.day + interval '1 day'
        GROUP BY spine.day
        ORDER BY spine.day`,
      [userId, days],
    ).then(({ rows }) => rows.map((r) => ({ date: r.date, count: r.count })));
  }
}
