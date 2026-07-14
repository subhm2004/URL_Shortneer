import { ValidationError } from "../../core/errors.js";
import ShortCodeStrategy from "./ShortCodeStrategy.js";

const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

/**
 * Reserved words that would otherwise shadow a real route: a link at /api or
 * /login would be unreachable, because the router matches those first.
 */
const RESERVED = new Set([
  "api", "login", "register", "dashboard", "mcp", "shorten",
  "health", "admin", "static", "assets", "favicon.ico", "robots.txt",
]);

/**
 * Lets a signed-in user pick their own slug (`/launch` instead of `/x7Kp2mQ1`).
 *
 * Unlike the random strategies this one can *fail* — the alias is user input, so
 * it is validated rather than generated. That asymmetry is exactly why the
 * generator is an interface: the caller just asks for a code and handles the
 * error, without knowing which strategy produced it.
 */
export default class CustomAliasStrategy extends ShortCodeStrategy {
  #fallback;

  /** @param {ShortCodeStrategy} fallback used when no alias is supplied */
  constructor(fallback) {
    super();
    this.#fallback = fallback;
  }

  get name() {
    return "custom-alias";
  }

  generate(context = {}) {
    const alias = context.customAlias?.trim();

    if (!alias) return this.#fallback.generate(context);

    if (!ALIAS_PATTERN.test(alias)) {
      throw new ValidationError(
        "A custom alias must be 3–32 characters, using letters, numbers, hyphens or underscores only.",
      );
    }

    if (RESERVED.has(alias.toLowerCase())) {
      throw new ValidationError(`"${alias}" is a reserved word — pick another alias.`);
    }

    return alias;
  }
}
