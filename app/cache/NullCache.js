/**
 * Null Object — a cache that never caches. Turning caching off is then a matter
 * of injecting this instead of scattering `if (this.cache)` guards through the
 * decorator, which is where cache bugs come from.
 */
export default class NullCache {
  // eslint-disable-next-line class-methods-use-this
  get() {
    return undefined;
  }

  // eslint-disable-next-line class-methods-use-this
  set() {}

  // eslint-disable-next-line class-methods-use-this
  delete() {}

  // eslint-disable-next-line class-methods-use-this
  get size() {
    return 0;
  }
}
