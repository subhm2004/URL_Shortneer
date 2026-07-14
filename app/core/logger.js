import config from "../config/index.js";

/**
 * Singleton — a level-filtered logger so we can stop sprinkling raw console.log
 * (which previously printed user emails and full tokens to stdout).
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

/** Values under these keys are never printed, however deeply nested. */
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "jwt",
  "authorization",
  "secret",
]);

function redact(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key) ? "[redacted]" : redact(val);
  }
  return out;
}

class Logger {
  #threshold;

  constructor(level) {
    this.#threshold = LEVELS[level] ?? LEVELS.info;
  }

  #write(level, message, meta) {
    if (LEVELS[level] > this.#threshold) return;

    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(meta ? redact(meta) : {}),
    };

    const line = config.isProduction
      ? JSON.stringify(entry)
      : `[${level}] ${message}${meta ? " " + JSON.stringify(redact(meta)) : ""}`;

    (level === "error" ? console.error : console.log)(line);
  }

  error(message, meta) {
    this.#write("error", message, meta);
  }
  warn(message, meta) {
    this.#write("warn", message, meta);
  }
  info(message, meta) {
    this.#write("info", message, meta);
  }
  debug(message, meta) {
    this.#write("debug", message, meta);
  }
}

export default new Logger(config.logLevel);
