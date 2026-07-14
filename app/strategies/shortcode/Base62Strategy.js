import { randomBytes } from "node:crypto";
import ShortCodeStrategy from "./ShortCodeStrategy.js";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Classic base62 over cryptographically random bytes. Functionally close to the
 * nanoid strategy — it exists to prove the seam is real: swapping
 * SHORT_CODE_STRATEGY=base62 changes how every code is minted and not one line
 * of UrlService moves.
 */
export default class Base62Strategy extends ShortCodeStrategy {
  #length;

  constructor({ length = 7 } = {}) {
    super();
    this.#length = length;
  }

  get name() {
    return "base62";
  }

  generate() {
    // Rejection-free approach: take one random byte per character and reduce it
    // modulo 62. The bias this introduces is negligible for link codes.
    const bytes = randomBytes(this.#length);
    let code = "";
    for (let i = 0; i < this.#length; i++) {
      code += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return code;
  }
}
