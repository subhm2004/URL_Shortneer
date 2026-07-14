/**
 * Strategy — the interface every short-code generator implements.
 *
 * Generating the code was previously a hardcoded `nanoid(8)` sitting in the
 * middle of the controller. Behind this interface, the algorithm becomes a
 * runtime choice (SHORT_CODE_STRATEGY env var) and the service that calls it
 * never changes.
 *
 * @abstract
 */
export default class ShortCodeStrategy {
  /** Human-readable id, used by the factory and in logs. */
  get name() {
    throw new Error(`${this.constructor.name} must implement get name()`);
  }

  /**
   * @param {object} [context] e.g. { customAlias, longUrl, userId }
   * @returns {Promise<string> | string} the code (not the full URL)
   */
  // eslint-disable-next-line no-unused-vars
  generate(context) {
    throw new Error(`${this.constructor.name} must implement generate()`);
  }
}
