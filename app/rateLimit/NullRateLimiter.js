import RateLimiter from "./RateLimiter.js";

/**
 * Null Object — a limiter that never limits.
 *
 * Turning rate limiting off (in tests, or via RATE_LIMIT_ENABLED=false) is an
 * injection, not an `if (limiter)` guard threaded through the middleware. The
 * middleware has exactly one path, and that path is always exercised.
 */
export default class NullRateLimiter extends RateLimiter {
  consume() {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      resetSeconds: 0,
      retryAfterSeconds: 0,
    };
  }
}
