/**
 * Chain of Responsibility — each rule inspects the candidate and either passes
 * it along or rejects it. Rules don't know what comes after them, so the order
 * and the membership of the chain are configuration, not code.
 *
 * URL validation was a single `validUrl.isUri()` call, which accepts things we
 * must not shorten: `javascript:alert(1)`, `http://localhost:5000/admin`,
 * `http://169.254.169.254/` (the cloud metadata endpoint). Splitting the checks
 * into named rules makes each one testable and the omissions obvious.
 *
 * @abstract
 */
export default class ValidationRule {
  #next = null;

  get name() {
    return this.constructor.name;
  }

  setNext(rule) {
    this.#next = rule;
    return rule;
  }

  /**
   * Subclasses implement this. Throw to reject; return (optionally a rewritten
   * value) to accept.
   * @abstract
   */
  // eslint-disable-next-line no-unused-vars
  check(value, context) {
    throw new Error(`${this.constructor.name} must implement check()`);
  }

  /** Runs this rule, then hands the (possibly normalised) value to the next. */
  handle(value, context = {}) {
    const result = this.check(value, context) ?? value;
    return this.#next ? this.#next.handle(result, context) : result;
  }
}
