import assert from "node:assert/strict";
import { describe, it } from "node:test";
import TokenBucketLimiter from "../rateLimit/TokenBucketLimiter.js";
import { fakeClock } from "./helpers/fakes.js";

describe("TokenBucketLimiter", () => {
  it("allows a burst up to capacity, then refuses", () => {
    const limiter = new TokenBucketLimiter({ capacity: 5, refillPerSecond: 1 });

    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.consume("k").allowed, true, `request ${i + 1} should pass`);
    }
    assert.equal(limiter.consume("k").allowed, false, "the 6th is over budget");
  });

  it("refills over time — the whole point, tested without waiting", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({
      capacity: 5,
      refillPerSecond: 1,
      now: clock.now,
    });

    // Drain it.
    for (let i = 0; i < 5; i++) limiter.consume("k");
    assert.equal(limiter.consume("k").allowed, false);

    // Three seconds → three tokens.
    clock.advanceSeconds(3);
    assert.equal(limiter.consume("k").allowed, true);
    assert.equal(limiter.consume("k").allowed, true);
    assert.equal(limiter.consume("k").allowed, true);
    assert.equal(limiter.consume("k").allowed, false, "only three had refilled");
  });

  it("never accumulates beyond capacity, however long it's been idle", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({
      capacity: 5,
      refillPerSecond: 1,
      now: clock.now,
    });

    // Idle for an hour. A bucket that kept counting would now hold 3600 tokens,
    // and the burst protection would be meaningless.
    clock.advanceSeconds(3600);

    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      if (limiter.consume("k").allowed) allowed++;
    }
    assert.equal(allowed, 5, "capped at capacity, not the elapsed seconds");
  });

  it("keeps separate buckets per key", () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 0.0001 });

    assert.equal(limiter.consume("alice").allowed, true);
    assert.equal(limiter.consume("alice").allowed, true);
    assert.equal(limiter.consume("alice").allowed, false);

    // Bob is untouched by Alice exhausting her budget.
    assert.equal(limiter.consume("bob").allowed, true);
  });

  it("reports headroom and a retry hint", () => {
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1 });

    const first = limiter.consume("k");
    assert.equal(first.limit, 3);
    assert.equal(first.remaining, 2);
    assert.equal(first.retryAfterSeconds, 1); // always ≥ 1, never 0

    limiter.consume("k");
    limiter.consume("k");
    const blocked = limiter.consume("k");

    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it("evicts the oldest key rather than growing without bound", () => {
    // Buckets are keyed by IP; an attacker rotating IPs would otherwise grow the
    // map until the process dies — the limiter becoming the denial of service.
    const limiter = new TokenBucketLimiter({
      capacity: 1,
      refillPerSecond: 0.0001,
      maxKeys: 3,
    });

    limiter.consume("a");
    limiter.consume("b");
    limiter.consume("c");
    limiter.consume("d"); // evicts "a", the least recently used

    assert.equal(limiter.size, 3);

    // "a" was evicted, so it starts fresh — a full bucket again.
    assert.equal(limiter.consume("a").remaining, 0); // capacity 1, one just spent
  });
});
