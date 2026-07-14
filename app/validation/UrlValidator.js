import {
  MaxLengthRule,
  NoSelfReferenceRule,
  ParsableRule,
  ProtocolRule,
  PublicHostRule,
  RequiredRule,
} from "./rules/urlRules.js";

/**
 * Assembles the validation chain. Order matters and is asserted here rather than
 * being implicit: nothing can inspect `context.parsed` until ParsableRule has
 * run, so ParsableRule must come before ProtocolRule and PublicHostRule.
 */
export default class UrlValidator {
  #head;

  constructor({ baseUrl, maxLength = 2048 } = {}) {
    const required = new RequiredRule();

    required
      .setNext(new MaxLengthRule(maxLength))
      .setNext(new ParsableRule())
      .setNext(new ProtocolRule())
      .setNext(new PublicHostRule())
      .setNext(new NoSelfReferenceRule(baseUrl));

    this.#head = required;
  }

  /**
   * @returns {string} the normalised URL
   * @throws {ValidationError} on the first rule that rejects
   */
  validate(longUrl) {
    return this.#head.handle(longUrl, {});
  }
}
