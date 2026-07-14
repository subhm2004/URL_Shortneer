import assert from "node:assert/strict";
import { describe, it } from "node:test";
import UrlService from "../services/UrlService.js";
import { EVENTS } from "../core/EventBus.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../core/errors.js";
import {
  fakeEventBus,
  fakeStrategy,
  fakeUrlRepository,
  makeUniqueViolation,
  passthroughValidator,
  testConfig,
} from "./helpers/fakes.js";

function build({ repo, strategy, validator, events } = {}) {
  const urlRepository = repo ?? fakeUrlRepository();
  const eventBus = events ?? fakeEventBus();

  const service = new UrlService({
    urlRepository,
    urlValidator: validator ?? passthroughValidator,
    shortCodeStrategy: strategy ?? fakeStrategy(),
    eventBus,
    config: testConfig,
  });

  return { service, urlRepository, eventBus };
}

describe("UrlService.shorten", () => {
  it("returns the existing link instead of minting a second one", async () => {
    const existing = { id: "u1", urlCode: "OLD00001", longUrl: "https://a.test" };
    const repo = fakeUrlRepository({
      findByLongUrlAndUser: async () => existing,
      create: async () => assert.fail("should not have created a second row"),
    });

    const { service } = build({ repo });
    const result = await service.shorten({ longUrl: "https://a.test", userId: "user-1" });

    assert.equal(result.created, false);
    assert.equal(result.url, existing);
  });

  it("retries with a fresh code when the database rejects a collision", async () => {
    let attempts = 0;
    const repo = fakeUrlRepository({
      async create(input) {
        attempts++;
        // The first two codes collide; the third is accepted.
        if (attempts < 3) throw makeUniqueViolation("urls_url_code_key");
        return { id: "u1", urlCode: input.urlCode, longUrl: input.longUrl };
      },
    });

    const { service } = build({
      repo,
      strategy: fakeStrategy(["TAKEN001", "TAKEN002", "FREE0003"]),
    });

    const { url, created } = await service.shorten({
      longUrl: "https://a.test",
      userId: "u",
    });

    assert.equal(attempts, 3);
    assert.equal(created, true);
    assert.equal(url.urlCode, "FREE0003");
  });

  it("gives up after maxAttempts rather than looping forever", async () => {
    const repo = fakeUrlRepository({
      async create() {
        throw makeUniqueViolation("urls_url_code_key");
      },
    });

    const { service } = build({ repo });

    await assert.rejects(
      () => service.shorten({ longUrl: "https://a.test", userId: "u" }),
      /Could not generate a unique short code/,
    );
  });

  it("returns the winner's row when a concurrent request created the same link", async () => {
    const theirs = { id: "u9", urlCode: "THEIRS01", longUrl: "https://a.test" };
    let lookups = 0;

    const repo = fakeUrlRepository({
      async findByLongUrlAndUser() {
        // First call (the idempotency check) finds nothing. The second — after the
        // insert loses the race — finds the row the other request just wrote.
        lookups++;
        return lookups === 1 ? null : theirs;
      },
      async create() {
        throw makeUniqueViolation("urls_long_url_user_key");
      },
    });

    const { service } = build({ repo });
    const result = await service.shorten({ longUrl: "https://a.test", userId: "u" });

    assert.equal(result.urlCode ?? result.url?.urlCode, "THEIRS01");
  });

  it("refuses a custom alias from an anonymous caller", async () => {
    const { service } = build();

    // An alias is a claim on a scarce, global namespace. Handing one to a caller
    // with no account is handing out a squatting tool with nobody to reclaim from.
    await assert.rejects(
      () => service.shorten({ longUrl: "https://a.test", userId: null, customAlias: "google" }),
      UnauthorizedError,
    );
  });

  it("reports a taken alias as a conflict rather than silently generating another", async () => {
    const repo = fakeUrlRepository({
      async create() {
        throw makeUniqueViolation("urls_url_code_key");
      },
    });

    const { service } = build({ repo });

    await assert.rejects(
      () => service.shorten({ longUrl: "https://a.test", userId: "u", customAlias: "taken" }),
      ConflictError,
    );
  });

  it("validates before it writes", async () => {
    const repo = fakeUrlRepository({
      create: async () => assert.fail("must not write an unvalidated URL"),
    });

    const rejecting = {
      validate() {
        throw new Error("nope");
      },
    };

    const { service } = build({ repo, validator: rejecting });
    await assert.rejects(() => service.shorten({ longUrl: "javascript:alert(1)" }));
  });
});

describe("UrlService.resolve", () => {
  it("publishes the click without waiting for it to be written", async () => {
    const url = { id: "u1", urlCode: "ABC", longUrl: "https://a.test" };
    const repo = fakeUrlRepository({ findByCode: async () => url });
    const events = fakeEventBus();

    const { service } = build({ repo, events });
    const resolved = await service.resolve({ urlCode: "ABC" });

    assert.equal(resolved, url);
    assert.equal(events.published.length, 1);
    assert.equal(events.published[0].event, EVENTS.LINK_CLICKED);

    // The point of the Observer seam: resolve() returns having touched the
    // database exactly once — to read. It never called a write.
    assert.ok(
      !repo.calls.some(([name]) => name === "incrementClickCount"),
      "resolve() must not await the click write",
    );
  });

  it("404s an unknown code", async () => {
    const { service } = build();
    await assert.rejects(() => service.resolve({ urlCode: "nope" }), NotFoundError);
  });
});

describe("UrlService.remove and .repoint", () => {
  it("reports someone else's link as not found, never as forbidden", async () => {
    // deleteForUser returns null: ownership is in the WHERE clause, so a link
    // belonging to another user simply doesn't match.
    const { service } = build();

    await assert.rejects(
      () => service.remove({ urlCode: "theirs", userId: "me" }),
      // A 403 would confirm the link exists and belongs to somebody. It doesn't.
      (err) => err instanceof NotFoundError && err.statusCode === 404,
    );
  });

  it("runs the new destination through the validator when repointing", async () => {
    const rejecting = {
      validate() {
        throw new Error("blocked");
      },
    };

    const repo = fakeUrlRepository({
      updateLongUrlForUser: async () =>
        assert.fail("must not write an unvalidated destination"),
    });

    const { service } = build({ repo, validator: rejecting });

    // Without this, the chain has a hole straight through it: shorten something
    // harmless, then edit it into javascript:alert(1).
    await assert.rejects(() =>
      service.repoint({ urlCode: "abc", userId: "u", longUrl: "javascript:alert(1)" }),
    );
  });
});

describe("UrlService.listForUser", () => {
  it("asks for one row more than the page size, to know if there's a next page", async () => {
    let askedFor = null;
    const repo = fakeUrlRepository({
      async findByUser(_userId, options) {
        askedFor = options;
        return [];
      },
    });

    const { service } = build({ repo });
    await service.listForUser("u", { limit: 20 });

    // The extra row is how "hasMore" is answered without a second COUNT query.
    assert.equal(askedFor.limit, 21);
  });

  it("does not return the extra row, and hands back a cursor instead", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `id-${i}`,
      urlCode: `C${i}`,
      createdAt: new Date(2026, 0, 10 - i),
    }));

    const repo = fakeUrlRepository({ findByUser: async () => rows });
    const { service } = build({ repo });

    const page = await service.listForUser("u", { limit: 5 });

    assert.equal(page.links.length, 5, "the 6th row is a probe, not a result");
    assert.ok(page.nextCursor, "a full page must offer a cursor");
  });

  it("stops when the page isn't full", async () => {
    const repo = fakeUrlRepository({
      findByUser: async () => [{ id: "a", urlCode: "A", createdAt: new Date() }],
    });

    const { service } = build({ repo });
    const page = await service.listForUser("u", { limit: 5 });

    assert.equal(page.nextCursor, null);
  });

  it("serves page one for a malformed cursor rather than throwing", async () => {
    let received;
    const repo = fakeUrlRepository({
      async findByUser(_u, options) {
        received = options;
        return [];
      },
    });

    const { service } = build({ repo });
    await service.listForUser("u", { cursor: "!!!not-base64!!!" });

    // Throwing would let anyone trigger a 400 storm by fuzzing the query string.
    assert.equal(received.cursor, null);
  });

  it("clamps an absurd page size", async () => {
    let received;
    const repo = fakeUrlRepository({
      async findByUser(_u, options) {
        received = options;
        return [];
      },
    });

    const { service } = build({ repo });
    await service.listForUser("u", { limit: 100_000 });

    assert.equal(received.limit, 101, "100 + the probe row");
  });
});
