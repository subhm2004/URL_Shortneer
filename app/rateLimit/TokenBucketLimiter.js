import RateLimiter from "./RateLimiter.js";

/**
 * Token bucket.
 *
 * Every key owns a bucket holding at most `capacity` tokens, refilled at
 * `refillPerSecond`. A request spends one token; an empty bucket is a 429.
 *
 * ---------------------------------------------------------------------------
 * Why this algorithm, and not one of the other three
 * ---------------------------------------------------------------------------
 *
 * FIXED WINDOW is the obvious one and it is quietly broken: a 10/minute limit
 * lets through 20 requests across a window boundary — ten at 11:59:59 and ten at
 * 12:00:00 — which is exactly when an attacker will send them.
 *
 * SLIDING WINDOW LOG is exact, and stores a timestamp for every request. Memory
 * grows with traffic, which is a strange property for the component whose job is
 * to survive a flood.
 *
 * SLIDING WINDOW COUNTER fixes both and forbids bursts entirely — and bursts are
 * the *normal* traffic shape here. Someone pastes four links in ten seconds and
 * then does nothing for an hour. Refusing their fourth link is refusing a real
 * user to stop an attacker who could simply have waited.
 *
 * TOKEN BUCKET allows the burst (up to `capacity`) while capping the sustained
 * rate at `refillPerSecond`. That is the distinction that actually matters:
 * *bursty is normal; sustained is abuse.* It's what AWS API Gateway, Stripe and
 * GitHub all use a variant of.
 *
 * ---------------------------------------------------------------------------
 * Implementation notes
 * ---------------------------------------------------------------------------
 *
 * Refill is LAZY. There is no timer and no background sweep: a bucket's token
 * count is computed from the elapsed time when it is next touched. O(1) memory
 * per key, O(1) work per request, and an idle key costs nothing at all.
 *
 * ---------------------------------------------------------------------------
 * The honest limitation
 * ---------------------------------------------------------------------------
 *
 * State lives in this process. Run two instances behind a load balancer and each
 * keeps its own buckets — so the effective limit becomes N times the configured
 * one. That is fine for a single Render service and a lie waiting to happen the
 * moment it scales.
 *
 * This is precisely why the limiter sits behind an interface: a Redis-backed
 * sibling of this class is the fix, and nothing else has to change.
 */
export default class TokenBucketLimiter extends RateLimiter {
  #buckets = new Map();
  #capacity;
  #refillPerSecond;
  #maxKeys;

  #now;

  /**
   * @param {object}    opts
   * @param {number}    opts.capacity          burst size — the most that can be spent at once
   * @param {number}    opts.refillPerSecond   the sustained rate
   * @param {number}   [opts.maxKeys]          eviction ceiling; see below
   * @param {function} [opts.now]              the clock, injected
   */
  constructor({ capacity, refillPerSecond, maxKeys = 10_000, now = Date.now }) {
    super();
    this.#capacity = capacity;
    this.#refillPerSecond = refillPerSecond;
    this.#maxKeys = maxKeys;

    /**
     * The clock is a dependency, like any other.
     *
     * Reaching for Date.now() directly would make refill untestable without
     * actually waiting — a test for "one token every six seconds" would have to
     * sleep six seconds, which is how test suites become slow enough that people
     * stop running them. Injecting it means the whole refill curve is exercised
     * in microseconds.
     */
    this.#now = now;
  }

  consume(key) {
    const now = this.#now();
    const bucket = this.#buckets.get(key) ?? {
      tokens: this.#capacity,
      updatedAt: now,
    };

    // Lazy refill: however long it's been, add that many tokens, capped.
    const elapsedSeconds = (now - bucket.updatedAt) / 1000;
    const tokens = Math.min(
      this.#capacity,
      bucket.tokens + elapsedSeconds * this.#refillPerSecond,
    );

    const allowed = tokens >= 1;
    const remaining = allowed ? tokens - 1 : tokens;

    this.#store(key, { tokens: remaining, updatedAt: now });

    // Seconds until one more token exists — what the client should wait.
    const deficit = Math.max(0, 1 - remaining);
    const retryAfterSeconds = Math.ceil(deficit / this.#refillPerSecond);

    // Seconds until the bucket is full again — the window "reset" in RFC terms.
    const toFull = this.#capacity - remaining;
    const resetSeconds = Math.ceil(toFull / this.#refillPerSecond);

    return {
      allowed,
      limit: this.#capacity,
      remaining: Math.floor(remaining),
      resetSeconds,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  /**
   * Buckets are keyed by user id or IP, so the map is unbounded by nature — an
   * attacker rotating IPs would otherwise grow it until the process dies, turning
   * the rate limiter itself into the denial of service.
   *
   * Map preserves insertion order, so the first key is the least recently
   * inserted. Re-inserting on write makes that least-recently-*used*.
   */
  #store(key, bucket) {
    if (this.#buckets.size >= this.#maxKeys && !this.#buckets.has(key)) {
      const oldest = this.#buckets.keys().next().value;
      this.#buckets.delete(oldest);
    }
    this.#buckets.delete(key);
    this.#buckets.set(key, bucket);
  }

  /** For tests and for the /health surface. */
  get size() {
    return this.#buckets.size;
  }
}
