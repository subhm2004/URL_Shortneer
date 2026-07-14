import { AppError } from "../core/errors.js";
import logger from "../core/logger.js";

export class TooManyRequestsError extends AppError {
  constructor(retryAfterSeconds) {
    super(
      `Too many requests. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
      429,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Identifies the caller.
 *
 * A signed-in user is limited by *user id*, not by IP. Two things follow from
 * that, both of them wanted:
 *
 *   - an office or a university behind one NAT doesn't share one budget
 *   - signing out and back in doesn't reset your budget
 *
 * Anonymous callers fall back to IP, which is the only handle we have. `trust
 * proxy` is set in server.js, so req.ip is the real client address rather than
 * Render's load balancer — without it, *every* anonymous request would share a
 * single bucket and the first spammer would lock out the whole internet.
 */
function identify(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
}

/**
 * @param {import("../rateLimit/RateLimiter.js").default} limiter
 * @param {string} name  used in logs, and to namespace the key so a user's
 *                       login budget and shorten budget are separate buckets
 */
export function rateLimit(limiter, name) {
  return function rateLimitMiddleware(req, res, next) {
    const key = `${name}:${identify(req)}`;
    const result = limiter.consume(key);

    // The IETF draft headers (RateLimit-*) that Stripe, GitHub and Cloudflare all
    // send. A client that reads them can back off *before* being refused, which is
    // the entire point — a limiter that only says "no" teaches nothing.
    if (Number.isFinite(result.limit)) {
      res.set("RateLimit-Limit", String(result.limit));
      res.set("RateLimit-Remaining", String(Math.max(0, result.remaining)));
      res.set("RateLimit-Reset", String(result.resetSeconds));
    }

    if (result.allowed) return next();

    // Retry-After is the one header that is actually standardised (RFC 9110) and
    // the one well-behaved clients and crawlers obey.
    res.set("Retry-After", String(result.retryAfterSeconds));

    logger.warn("Rate limit exceeded", {
      bucket: name,
      key,
      retryAfter: result.retryAfterSeconds,
    });

    next(new TooManyRequestsError(result.retryAfterSeconds));
  };
}
