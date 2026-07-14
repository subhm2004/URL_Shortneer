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

  async overview(userId) {
    const [stats, links] = await Promise.all([
      this.#urls.statsForUser(userId),
      this.#urls.findByUser(userId),
    ]);

    const topLinks = [...links]
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, 5);

    return { ...stats, topLinks };
  }
}
