import { ValidationError } from "../../core/errors.js";
import ValidationRule from "../ValidationRule.js";

export class RequiredRule extends ValidationRule {
  check(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new ValidationError("Send a long URL to shorten.");
    }
    return value.trim();
  }
}

export class MaxLengthRule extends ValidationRule {
  #max;

  constructor(max = 2048) {
    super();
    this.#max = max;
  }

  check(value) {
    if (value.length > this.#max) {
      throw new ValidationError(`That URL is too long (max ${this.#max} characters).`);
    }
    return value;
  }
}

/** Must parse as a URL at all. Also normalises it (adds the trailing-slash path etc). */
export class ParsableRule extends ValidationRule {
  check(value, context) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new ValidationError("That doesn't look like a valid URL (try https://example.com).");
    }
    // Stash the parsed object so later rules don't each re-parse the string.
    context.parsed = parsed;
    return value;
  }
}

/**
 * `javascript:`, `data:` and `file:` URLs are the interesting attack here — a
 * short link that runs script in the clicker's browser, or reads their disk.
 * An allowlist (not a blocklist) is the only safe shape for this check.
 */
export class ProtocolRule extends ValidationRule {
  static ALLOWED = new Set(["http:", "https:"]);

  check(value, context) {
    const { protocol } = context.parsed;
    if (!ProtocolRule.ALLOWED.has(protocol)) {
      throw new ValidationError("Only http:// and https:// URLs can be shortened.");
    }
    return value;
  }
}

/**
 * Blocks private/loopback/link-local addresses. Without this the shortener is an
 * SSRF gadget: anyone could mint a link to http://169.254.169.254/ (AWS instance
 * metadata) or to a service on our own private network and use our domain to
 * make it look legitimate.
 */
export class PublicHostRule extends ValidationRule {
  static BLOCKED_HOSTNAMES = new Set([
    "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]",
    "169.254.169.254", "metadata.google.internal",
  ]);

  static PRIVATE_RANGES = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^127\./,
    /^169\.254\./,
  ];

  check(value, context) {
    const host = context.parsed.hostname.toLowerCase();

    const isBlocked =
      PublicHostRule.BLOCKED_HOSTNAMES.has(host) ||
      PublicHostRule.PRIVATE_RANGES.some((re) => re.test(host)) ||
      host.endsWith(".local") ||
      host.endsWith(".internal");

    if (isBlocked) {
      throw new ValidationError("That URL points at a private or internal address.");
    }
    return value;
  }
}

/**
 * Refuses to shorten our own short links. Two of them chained together is a
 * redirect loop, and the redirect handler would happily serve it forever.
 */
export class NoSelfReferenceRule extends ValidationRule {
  #baseUrl;

  constructor(baseUrl) {
    super();
    this.#baseUrl = baseUrl;
  }

  check(value, context) {
    let baseHost;
    try {
      baseHost = new URL(this.#baseUrl).hostname.toLowerCase();
    } catch {
      return value; // BASE_URL misconfigured — not this rule's problem to police.
    }

    if (context.parsed.hostname.toLowerCase() === baseHost) {
      throw new ValidationError("That's already a short link from this service.");
    }
    return value;
  }
}
