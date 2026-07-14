import logger from "../core/logger.js";

/**
 * Decorator — wraps a UrlRepository and adds caching for the one lookup that is
 * on the hot path: `findByCode`, which every single redirect performs.
 *
 * It implements the same interface as the thing it wraps, so UrlService cannot
 * tell the difference and no service code changed to gain caching. Everything it
 * doesn't override is forwarded untouched.
 *
 * Only `findByCode` is cached. `findByLongUrlAndUser` is not: it runs on the
 * write path, where a stale answer would mean minting a duplicate row.
 */
export default class CachedUrlRepository {
  #inner;
  #cache;

  constructor(inner, cache) {
    this.#inner = inner;
    this.#cache = cache;
  }

  async findByCode(urlCode) {
    const key = `code:${urlCode}`;

    const hit = this.#cache.get(key);
    if (hit !== undefined) {
      logger.debug("Cache hit", { urlCode });
      return hit;
    }

    const url = await this.#inner.findByCode(urlCode);

    // Misses are cached too (as null). Otherwise a bot hammering nonexistent
    // codes would hit Postgres on every request.
    this.#cache.set(key, url);
    return url;
  }

  async create(input) {
    const url = await this.#inner.create(input);
    // A previously-cached "this code doesn't exist" null must not outlive the row.
    this.#cache.delete(`code:${url.urlCode}`);
    return url;
  }

  /**
   * Not written through to the cache: the cached entry is only used to resolve a
   * redirect target, and a slightly stale click_count there is harmless. The
   * authoritative count is always read from Postgres by the dashboard.
   */
  incrementClickCount(urlId) {
    return this.#inner.incrementClickCount(urlId);
  }

  codeExists(urlCode) {
    return this.#inner.codeExists(urlCode);
  }

  findByLongUrlAndUser(longUrl, userId) {
    return this.#inner.findByLongUrlAndUser(longUrl, userId);
  }

  findByUser(userId) {
    return this.#inner.findByUser(userId);
  }

  statsForUser(userId) {
    return this.#inner.statsForUser(userId);
  }
}
