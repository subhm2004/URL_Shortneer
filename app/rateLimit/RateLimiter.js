/**
 * Strategy — the interface every rate-limiting algorithm implements.
 *
 * Behind this seam the algorithm is a configuration choice. Swapping the token
 * bucket for a sliding-window counter, or for a Redis-backed limiter once there
 * is more than one instance, means writing one class with this shape and changing
 * one line in the container. No middleware moves, no route changes.
 *
 * @abstract
 */
export default class RateLimiter {
  /**
   * @param {string} key    who is being limited — a user id, or an IP
   * @returns {{
   *   allowed: boolean,
   *   limit: number,
   *   remaining: number,
   *   resetSeconds: number,
   *   retryAfterSeconds: number,
   * }}
   */
  // eslint-disable-next-line no-unused-vars
  consume(key) {
    throw new Error(`${this.constructor.name} must implement consume()`);
  }
}
