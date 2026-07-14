/**
 * A small TTL + LRU cache. Deliberately in-process and dependency-free: the
 * point is that CachedUrlRepository depends on this *interface*, so swapping in
 * a Redis-backed cache later means writing one new class with the same three
 * methods and changing one line in the container — no service code moves.
 */
export default class InMemoryCache {
  #store = new Map();
  #maxEntries;
  #ttlMs;

  constructor({ maxEntries = 1000, ttlMs = 60_000 } = {}) {
    this.#maxEntries = maxEntries;
    this.#ttlMs = ttlMs;
  }

  get(key) {
    const entry = this.#store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return undefined;
    }

    // Re-insert to mark as most-recently used: Map preserves insertion order, so
    // the oldest key is always the first one iterated.
    this.#store.delete(key);
    this.#store.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.#store.size >= this.#maxEntries && !this.#store.has(key)) {
      const oldest = this.#store.keys().next().value;
      this.#store.delete(oldest);
    }
    this.#store.set(key, { value, expiresAt: Date.now() + this.#ttlMs });
  }

  delete(key) {
    this.#store.delete(key);
  }

  get size() {
    return this.#store.size;
  }
}
