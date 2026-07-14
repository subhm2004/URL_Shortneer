import { config as loadEnv } from "dotenv";

loadEnv();

/**
 * Singleton — the process reads its environment exactly once, validates it here,
 * and every other module consumes this frozen object instead of touching
 * `process.env` directly. A missing required var fails at boot, not at the first
 * request that happens to need it.
 */

const REQUIRED = ["DATABASE_URL", "JWT_SECRET"];

function required(name) {
  const value = process.env[name];
  if (!value) return null;
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function list(name, fallback) {
  const raw = process.env[name] || fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

const env = process.env.NODE_ENV || "development";

/**
 * Hosted Postgres (Neon, Supabase, Railway, Render) terminates TLS with a cert
 * that isn't in Node's trust store, so `rejectUnauthorized: false` is what makes
 * those connection strings work. A plain local/Docker Postgres speaks no TLS at
 * all, so SSL is off there.
 */
function sslFor(connectionString) {
  if (!connectionString) return false;
  if (bool("DATABASE_SSL", false)) return { rejectUnauthorized: false };

  const isLocal =
    connectionString.includes("@localhost") ||
    connectionString.includes("@127.0.0.1") ||
    connectionString.includes("@postgres:");

  return isLocal ? false : { rejectUnauthorized: false };
}

const databaseUrl = required("DATABASE_URL");

const config = Object.freeze({
  env,
  isProduction: env === "production",
  isDevelopment: env === "development",

  // 5050, not 5000: on macOS the AirPlay Receiver binds 5000 and silently
  // swallows requests to it. Docker sets PORT explicitly, so this default only
  // ever applies to local dev.
  port: int("PORT", 5050),

  /** Public origin short links are minted against, e.g. https://trunc.sh/abc123 */
  baseUrl: (process.env.BASE_URL || "http://localhost:5050").replace(/\/+$/, ""),

  allowedOrigins: list("ALLOWED_ORIGINS", "http://localhost:5173"),

  db: Object.freeze({
    connectionString: databaseUrl,
    ssl: sslFor(databaseUrl),
    max: int("DATABASE_POOL_MAX", 10),
    idleTimeoutMillis: int("DATABASE_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMillis: int("DATABASE_CONNECT_TIMEOUT_MS", 10_000),
  }),

  auth: Object.freeze({
    jwtSecret: required("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
    bcryptRounds: int("BCRYPT_ROUNDS", 10),
    minPasswordLength: int("MIN_PASSWORD_LENGTH", 8),
  }),

  /**
   * Google OAuth. Entirely optional — with no client id configured the routes
   * simply aren't mounted and the frontend hides the button, so the app runs
   * exactly as before. Nothing here is required to boot.
   */
  google: Object.freeze({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,

    /**
     * Must match a redirect URI registered in the Google Cloud console, byte for
     * byte — trailing slashes and http-vs-https included. A mismatch is the
     * single most common reason this flow fails, and Google's error says only
     * "redirect_uri_mismatch".
     */
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${(process.env.BASE_URL || "http://localhost:5050").replace(/\/+$/, "")}/api/auth/google/callback`,

    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  }),

  /** Where the OAuth flow sends the browser back to once we've issued our JWT. */
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, ""),

  shortCode: Object.freeze({
    /** Selects the code-generation Strategy. See strategies/shortcode/ */
    strategy: process.env.SHORT_CODE_STRATEGY || "nanoid",
    length: int("SHORT_CODE_LENGTH", 8),
    /** How many times to retry on a code collision before giving up. */
    maxAttempts: int("SHORT_CODE_MAX_ATTEMPTS", 5),
  }),

  cache: Object.freeze({
    enabled: bool("CACHE_ENABLED", true),
    maxEntries: int("CACHE_MAX_ENTRIES", 1000),
    ttlMs: int("CACHE_TTL_MS", 60_000),
  }),

  /**
   * Rate limits, as token buckets: `capacity` is the burst you may spend at once,
   * `refillPerSecond` is the rate you earn it back.
   *
   * The three buckets exist because the three endpoints are abused differently.
   *
   * The REDIRECT is deliberately absent. It is the product — a popular link
   * *should* be hammered, and limiting it would mean throttling the very success
   * the app exists to produce. It's also read-mostly and cached, so it's the
   * cheapest thing here.
   */
  rateLimit: Object.freeze({
    enabled: bool("RATE_LIMIT_ENABLED", true),

    /**
     * Creating links. The expensive, abusable one: it writes, and it's how a
     * spammer would mint phishing URLs on your domain in bulk.
     *
     * 10 at once, then one every 6s (600/hour sustained). A real person pasting
     * four links in ten seconds never notices; a script trying to mint thousands
     * hits the wall immediately.
     */
    shorten: Object.freeze({
      capacity: int("RATE_LIMIT_SHORTEN_BURST", 10),
      refillPerSecond: Number(process.env.RATE_LIMIT_SHORTEN_RPS ?? 1 / 6),
    }),

    /**
     * Login and register. This is brute-force protection, so it is deliberately
     * mean: 5 attempts, then one every 30 seconds.
     *
     * Someone who has genuinely forgotten their password tries three or four
     * times and stops. A credential-stuffing run makes thousands, and 120/hour is
     * useless to it.
     */
    auth: Object.freeze({
      capacity: int("RATE_LIMIT_AUTH_BURST", 5),
      refillPerSecond: Number(process.env.RATE_LIMIT_AUTH_RPS ?? 1 / 30),
    }),

    /** Reads. Generous — these are cheap, and a busy dashboard is a good sign. */
    read: Object.freeze({
      capacity: int("RATE_LIMIT_READ_BURST", 60),
      refillPerSecond: Number(process.env.RATE_LIMIT_READ_RPS ?? 1),
    }),
  }),

  logLevel: process.env.LOG_LEVEL || (env === "production" ? "info" : "debug"),
});

export function assertConfigValid() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy app/.env.example to app/.env and fill them in.`,
    );
  }
}

export default config;
