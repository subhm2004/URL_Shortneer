import { UNIQUE_VIOLATION } from "../repositories/BaseRepository.js";
import { EVENTS } from "../core/EventBus.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "../core/errors.js";
import logger from "../core/logger.js";

export default class UrlService {
  #urls;
  #validator;
  #codeStrategy;
  #events;
  #config;

  constructor({ urlRepository, urlValidator, shortCodeStrategy, eventBus, config }) {
    this.#urls = urlRepository;
    this.#validator = urlValidator;
    this.#codeStrategy = shortCodeStrategy;
    this.#events = eventBus;
    this.#config = config;
  }

  /**
   * @param {string} longUrl
   * @param {string|null} userId  null for anonymous
   * @param {string} [customAlias]
   */
  async shorten({ longUrl, userId = null, customAlias }) {
    /**
     * A custom alias needs an account, and a random code does not.
     *
     * The two are not the same kind of thing. A generated code is drawn from a
     * space nobody else wants; an alias is a claim on a *scarce, global*
     * namespace — there is exactly one /google, one /paypal, one /launch. Handing
     * those out to anonymous callers is handing out a squatting tool, and there
     * would be no one to take them back from.
     *
     * CustomAliasStrategy's own comment already said "lets a signed-in user pick
     * their own slug". It was the only thing enforcing it.
     */
    if (customAlias && !userId) {
      throw new UnauthorizedError("Sign in to claim a custom alias.");
    }

    const normalised = this.#validator.validate(longUrl);

    // Idempotent: pasting the same URL twice gives you back the same link rather
    // than a second one. Scoped per user, so two users shortening the same URL
    // each get their own code and their own click counts.
    const existing = await this.#urls.findByLongUrlAndUser(normalised, userId);
    if (existing && !customAlias) {
      return { url: existing, created: false };
    }

    const url = await this.#createWithUniqueCode(normalised, userId, customAlias);

    this.#events.publish(EVENTS.LINK_CREATED, { urlId: url.id, userId });

    return { url, created: true };
  }

  /**
   * Random codes collide — rarely, but a 56^8 space still has birthday collisions
   * once you have millions of links, and the unique index will reject them. Rather
   * than pre-checking (which races), we let Postgres be the arbiter and retry on
   * a unique violation.
   */
  async #createWithUniqueCode(longUrl, userId, customAlias) {
    const maxAttempts = this.#config.shortCode.maxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const urlCode = await this.#codeStrategy.generate({ customAlias, longUrl, userId });

      try {
        return await this.#urls.create({ urlCode, longUrl, userId });
      } catch (err) {
        if (err.code !== UNIQUE_VIOLATION) throw err;

        // A user-chosen alias that's taken is a 409 they can act on; retrying
        // would just generate the identical alias again.
        if (customAlias) {
          throw new ConflictError(`The alias "${customAlias}" is already taken.`);
        }

        // Losing the race on (long_url, user_id) means a concurrent request just
        // created this exact link. Return theirs.
        if (err.constraint?.startsWith("urls_long_url")) {
          const existing = await this.#urls.findByLongUrlAndUser(longUrl, userId);
          if (existing) return existing;
        }

        logger.warn("Short-code collision, retrying", { attempt, urlCode });
      }
    }

    throw new InternalError(
      `Could not generate a unique short code after ${maxAttempts} attempts.`,
    );
  }

  /**
   * Resolves a code to its destination and fires the click event.
   *
   * Note what this does *not* do: wait for the click to be written. The event is
   * published and the caller redirects immediately; observers persist the click
   * on the next tick. The visitor's redirect no longer waits on our analytics.
   */
  async resolve({ urlCode, referer, userAgent }) {
    const url = await this.#urls.findByCode(urlCode);

    if (!url) {
      throw new NotFoundError("That short link doesn't exist.");
    }

    this.#events.publish(EVENTS.LINK_CLICKED, {
      urlId: url.id,
      urlCode: url.urlCode,
      referer,
      userAgent,
    });

    return url;
  }

  listForUser(userId) {
    return this.#urls.findByUser(userId);
  }

  statsForUser(userId) {
    return this.#urls.statsForUser(userId);
  }
}
