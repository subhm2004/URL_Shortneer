const MIN_DAYS = 1;
const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;

export default class AnalyticsService {
  #clicks;
  #urls;

  constructor({ clickRepository, urlRepository }) {
    this.#clicks = clickRepository;
    this.#urls = urlRepository;
  }

  /** Clamps rather than rejects — a bad `?days=` shouldn't 400 a dashboard. */
  static parseDays(raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return DEFAULT_DAYS;
    return Math.min(MAX_DAYS, Math.max(MIN_DAYS, parsed));
  }

  clicksByDay(userId, days) {
    return this.#clicks.clicksByDayForUser(userId, AnalyticsService.parseDays(days));
  }

  /**
   * Totals, plus the five busiest links.
   *
   * Both come from SQL. This used to pull every link the user had ever created
   * into Node and sort them there — wasteful even when it worked, and outright
   * wrong once findByUser became paginated: it would have ranked the top five out
   * of whichever twenty rows the first page happened to contain.
   */
  async overview(userId) {
    const [stats, topLinks] = await Promise.all([
      this.#urls.statsForUser(userId),
      this.#urls.topLinksForUser(userId, 5),
    ]);

    return { ...stats, topLinks };
  }
}
