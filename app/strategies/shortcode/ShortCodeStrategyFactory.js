import Base62Strategy from "./Base62Strategy.js";
import CustomAliasStrategy from "./CustomAliasStrategy.js";
import NanoIdStrategy from "./NanoIdStrategy.js";

/**
 * Factory — turns the SHORT_CODE_STRATEGY config string into a strategy object.
 * This is the only place in the codebase that knows the concrete class names;
 * adding a fourth algorithm means adding one case here.
 *
 * Every strategy is wrapped in CustomAliasStrategy, which delegates to the
 * chosen generator whenever the request doesn't carry an alias.
 */
export default class ShortCodeStrategyFactory {
  static #registry = {
    nanoid: (opts) => new NanoIdStrategy(opts),
    base62: (opts) => new Base62Strategy(opts),
  };

  static create(name, options = {}) {
    const build = this.#registry[name];

    if (!build) {
      const known = Object.keys(this.#registry).join(", ");
      throw new Error(`Unknown SHORT_CODE_STRATEGY "${name}". Known strategies: ${known}`);
    }

    return new CustomAliasStrategy(build(options));
  }

  static available() {
    return Object.keys(this.#registry);
  }
}
