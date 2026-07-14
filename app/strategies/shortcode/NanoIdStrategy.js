import { customAlphabet } from "nanoid";
import ShortCodeStrategy from "./ShortCodeStrategy.js";

/**
 * The default. Random, unguessable codes — you cannot enumerate other people's
 * links by counting up from your own.
 *
 * The alphabet drops the characters that get misread out loud or in a screenshot
 * (0/O, 1/l/I), so a code is safe to read over a phone.
 */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export default class NanoIdStrategy extends ShortCodeStrategy {
  #generate;
  #length;

  constructor({ length = 8 } = {}) {
    super();
    this.#length = length;
    this.#generate = customAlphabet(ALPHABET, length);
  }

  get name() {
    return "nanoid";
  }

  get length() {
    return this.#length;
  }

  generate() {
    return this.#generate();
  }
}
