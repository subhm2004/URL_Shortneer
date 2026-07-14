/**
 * Test doubles.
 *
 * These exist because every service takes its collaborators through its
 * constructor and imports none of them. That is the entire payoff of the
 * dependency-injection seam, and this file is what cashes it: the tests below run
 * against fakes — no Postgres, no Express, no network, no clock — and finish in
 * milliseconds.
 *
 * If any of this were `import`ed rather than injected, none of it could be
 * replaced, and every one of these tests would need a database.
 */

/** Postgres' unique-violation code. */
export const UNIQUE_VIOLATION = "23505";

export function makeUniqueViolation(constraint) {
  const err = new Error("duplicate key value violates unique constraint");
  err.code = UNIQUE_VIOLATION;
  err.constraint = constraint;
  return err;
}

/**
 * An in-memory stand-in for UrlRepository. Records every call so a test can
 * assert on *how* it was used, not just what came back.
 */
export function fakeUrlRepository(overrides = {}) {
  const calls = [];

  const base = {
    calls,

    async findByCode() {
      calls.push(["findByCode", ...arguments]);
      return null;
    },
    async findByLongUrlAndUser() {
      calls.push(["findByLongUrlAndUser", ...arguments]);
      return null;
    },
    async create(input) {
      calls.push(["create", input]);
      return { id: "url-1", urlCode: input.urlCode, longUrl: input.longUrl, userId: input.userId };
    },
    async findByUser() {
      calls.push(["findByUser", ...arguments]);
      return [];
    },
    async deleteForUser() {
      calls.push(["deleteForUser", ...arguments]);
      return null;
    },
    async updateLongUrlForUser() {
      calls.push(["updateLongUrlForUser", ...arguments]);
      return null;
    },
    async incrementClickCount() {
      calls.push(["incrementClickCount", ...arguments]);
    },
    async statsForUser() {
      return { totalLinks: 0, totalClicks: 0 };
    },
    async topLinksForUser() {
      return [];
    },
  };

  return { ...base, ...overrides, calls };
}

export function fakeUserRepository(overrides = {}) {
  return {
    async findById() {
      return null;
    },
    async findByEmail() {
      return null;
    },
    async findByEmailWithPassword() {
      return null;
    },
    async findByGoogleId() {
      return null;
    },
    async create(input) {
      return { id: "user-1", name: input.name, email: input.email };
    },
    async createFromGoogle(input) {
      return { id: "user-g", name: input.name, email: input.email, hasGoogle: true };
    },
    async linkGoogle(id) {
      return { id, name: "Linked", email: "linked@example.com", hasGoogle: true };
    },
    ...overrides,
  };
}

/** Records what was published, synchronously — no setImmediate to wait on. */
export function fakeEventBus() {
  const published = [];
  return {
    published,
    publish(event, payload) {
      published.push({ event, payload });
    },
    subscribe() {},
  };
}

/** Always returns the same code, unless a queue of codes is supplied. */
export function fakeStrategy(codes = ["CODE0001"]) {
  const queue = [...codes];
  return {
    generate(context = {}) {
      if (context.customAlias) return context.customAlias;
      // Reuse the last one once exhausted, so a test can't run off the end.
      return queue.length > 1 ? queue.shift() : queue[0];
    },
  };
}

/** Passes everything through. Validation has its own tests. */
export const passthroughValidator = {
  validate: (url) => url,
};

export const testConfig = {
  shortCode: { maxAttempts: 3 },
  auth: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
    bcryptRounds: 4, // low on purpose — bcrypt is slow by design, and this is a test
    minPasswordLength: 8,
  },
};

/** A clock you control. */
export function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advanceSeconds(seconds) {
      now += seconds * 1000;
    },
  };
}
