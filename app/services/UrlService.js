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

  /**
   * One page of a user's links, plus a cursor for the next.
   *
   * The cursor is an opaque base64 string on purpose. It encodes (created_at, id)
   * — but a client that decodes it, and starts constructing its own, has coupled
   * itself to our pagination scheme, and we can never change it. Opaque means we
   * can switch keys, or move to a different strategy entirely, without breaking
   * anyone.
   */
  async listForUser(userId, { limit = 20, cursor = null } = {}) {
    const size = Math.min(100, Math.max(1, Number(limit) || 20));

    // Fetch one extra row. Its existence is how we know there's a next page —
    // without it we'd have to run a second COUNT query, which on a large table is
    // more expensive than the page itself.
    const rows = await this.#urls.findByUser(userId, {
      limit: size + 1,
      cursor: decodeCursor(cursor),
    });

    const hasMore = rows.length > size;
    const page = hasMore ? rows.slice(0, size) : rows;
    const last = page.at(-1);

    return {
      links: page,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  /**
   * Deletes a link the user owns.
   *
   * Ownership is enforced in the DELETE's WHERE clause, so a link belonging to
   * someone else simply doesn't match — and this reports it as "not found",
   * never as "forbidden". A 403 would confirm the link exists and belongs to
   * *somebody*, which is a small oracle worth not handing out.
   */
  async remove({ urlCode, userId }) {
    const deleted = await this.#urls.deleteForUser(urlCode, userId);

    if (!deleted) {
      throw new NotFoundError("That link doesn't exist, or isn't yours.");
    }

    logger.info("Link deleted", { urlCode });
    return deleted;
  }

  /**
   * Repoints a link at a new destination. The short code doesn't change — that is
   * the point: everyone who already has the link keeps working.
   *
   * The new URL goes through the same validation chain as a new one. Skipping it
   * here would be a hole straight through every rule the chain enforces: shorten
   * something harmless, then edit it to `javascript:alert(1)`.
   */
  async repoint({ urlCode, userId, longUrl }) {
    const normalised = this.#validator.validate(longUrl);

    const updated = await this.#urls.updateLongUrlForUser(
      urlCode,
      userId,
      normalised,
    );

    if (!updated) {
      throw new NotFoundError("That link doesn't exist, or isn't yours.");
    }

    logger.info("Link repointed", { urlCode });
    return updated;
  }

  statsForUser(userId) {
    return this.#urls.statsForUser(userId);
  }
}

/* ---------------------------------------------------------------------------
   Cursor encoding — kept out of the class because it is pure and testable alone.
   --------------------------------------------------------------------------- */

function encodeCursor(row) {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return Buffer.from(`${createdAt}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    const [createdAt, id] = Buffer.from(cursor, "base64url")
      .toString("utf8")
      .split("|");

    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    // A malformed cursor is a client bug, not an outage. Serving page one is a
    // better answer than a 500 — and the alternative, throwing, would let anyone
    // trigger a 400 storm by fuzzing the query string.
    return null;
  }
}
