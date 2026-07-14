/**
 * End-to-end smoke test. Drives a running server over HTTP — no mocks, no stubs,
 * a real Postgres behind it.
 *
 * It exists to keep the fixed bugs fixed. Each of these was a real defect, and a
 * unit test with a fake repository would have caught none of them:
 *
 *   - the click race only appears under genuine concurrency
 *   - the unique constraint on url_code only exists in the database
 *   - the SSRF/XSS rules only matter against the real validation chain
 *   - the 401s only happen if the real middleware is mounted on the real routes
 *
 * Usage:
 *   node scripts/smoke.mjs                    # against http://localhost:5050
 *   SMOKE_BASE_URL=... node scripts/smoke.mjs
 */

const BASE = (process.env.SMOKE_BASE_URL || "http://localhost:5050").replace(/\/+$/, "");

let passed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function json(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body, headers: res.headers };
}

async function run() {
  console.log(`Smoke test → ${BASE}\n${"─".repeat(50)}`);

  // ---- health ------------------------------------------------------------
  section("health");
  {
    const { status, body } = await json("/health");
    check("GET /health → 200", status === 200, `got ${status}`);
    check("reports ok", body?.status === "ok");
  }

  // ---- auth --------------------------------------------------------------
  section("auth");
  const email = `smoke-${Date.now()}@example.test`;
  const password = "smoke-test-password";
  let token;

  {
    const { status, body } = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Smoke", email, password }),
    });
    token = body?.token;
    check("register → 201", status === 201, `got ${status}`);
    check("register returns a token", typeof token === "string" && token.length > 20);
    check("register never returns the password hash", !JSON.stringify(body).includes("$2"));
  }

  {
    const { status } = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Dupe", email, password }),
    });
    check("duplicate email → 409", status === 409, `got ${status}`);
  }

  {
    const { status, body } = await json("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    check("wrong password → 401", status === 401, `got ${status}`);
    // Identical message for both cases, or an attacker can enumerate accounts.
    const { body: unknownUser } = await json("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@example.test", password }),
    });
    check(
      "unknown user and wrong password give the same message",
      body?.message === unknownUser?.message,
      `"${body?.message}" vs "${unknownUser?.message}"`,
    );
  }

  // ---- authorization -----------------------------------------------------
  section("authorization");
  {
    const noToken = await json("/api/links/my-links");
    check("/api/links without a token → 401", noToken.status === 401, `got ${noToken.status}`);

    const badToken = await json("/api/links/my-links", { token: "not-a-real-jwt" });
    check("/api/links with a bad token → 401", badToken.status === 401, `got ${badToken.status}`);
  }

  // ---- shorten -----------------------------------------------------------
  section("shorten");
  const longUrl = `https://example.com/smoke/${Date.now()}`;
  let code;

  {
    const { status, body } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl }),
    });
    code = body?.data?.url?.urlCode;
    check("shorten → 201", status === 201, `got ${status}`);
    check("returns a url_code", typeof code === "string" && code.length > 0);
    check("shortUrl is derived from BASE_URL", body?.data?.url?.shortUrl?.endsWith(`/${code}`));
  }

  {
    // Idempotent per user: the same long URL comes back, not a second row.
    const { status, body } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl }),
    });
    check("shortening the same URL again → 200, not a new link", status === 200, `got ${status}`);
    check("returns the same code", body?.data?.url?.urlCode === code);
  }

  {
    const alias = `smoke-${Date.now().toString(36)}`;
    const { status, body } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl: `https://example.com/alias/${alias}`, customAlias: alias }),
    });
    check("custom alias → 201", status === 201, `got ${status}`);
    check("uses the requested alias", body?.data?.url?.urlCode === alias);

    const conflict = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl: "https://example.com/other", customAlias: alias }),
    });
    check("taken alias → 409", conflict.status === 409, `got ${conflict.status}`);
  }

  {
    const { status } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl: "https://example.com/reserved", customAlias: "api" }),
    });
    // A link at /api would be shadowed by the router and unreachable.
    check("reserved word as alias → 400", status === 400, `got ${status}`);
  }

  // ---- validation chain --------------------------------------------------
  section("validation (each of these was accepted by the old validator)");
  const dangerous = [
    ["javascript:alert(1)", "javascript: — stored XSS"],
    ["data:text/html,<script>alert(1)</script>", "data: URL"],
    ["http://169.254.169.254/latest/meta-data", "cloud metadata endpoint — SSRF"],
    ["http://127.0.0.1:5050/admin", "loopback address"],
    ["http://10.0.0.1/internal", "private network"],
    ["ftp://files.example.com", "non-http protocol"],
    ["not-a-url-at-all", "unparseable"],
  ];

  for (const [url, label] of dangerous) {
    const { status } = await json("/api/shorten", {
      method: "POST",
      body: JSON.stringify({ longUrl: url }),
    });
    check(`rejects ${label}`, status === 400, `got ${status}`);
  }

  // ---- redirect ----------------------------------------------------------
  section("redirect");
  {
    const res = await fetch(`${BASE}/${code}`, { redirect: "manual" });
    // 302, not 301: a 301 is cached forever, so no click after the first would
    // ever reach the server and the count would freeze at 1.
    check("redirect → 302", res.status === 302, `got ${res.status}`);
    check("points at the destination", res.headers.get("location") === longUrl);

    const missing = await fetch(`${BASE}/definitely-not-a-real-code`, { redirect: "manual" });
    check("unknown code → 404", missing.status === 404, `got ${missing.status}`);
  }

  // ---- the click race ----------------------------------------------------
  section("click counting under concurrency");
  {
    const CLICKS = 50;
    const expected = CLICKS + 1; // +1 for the redirect test above

    await Promise.all(
      Array.from({ length: CLICKS }, () =>
        fetch(`${BASE}/${code}`, { redirect: "manual" }),
      ),
    );

    /**
     * Clicks are recorded by an observer, *after* the response is sent — that is
     * the whole point of the Observer seam, and it means the count is eventually
     * consistent, not immediately so.
     *
     * So poll for convergence instead of sleeping for a guessed duration. A fixed
     * sleep raced the writes: 50 clicks are 100 inserts through a pool of 10, and
     * against a remote Postgres that lands right around the 3s this used to wait.
     * It passed locally and would have started failing in CI at random.
     *
     * A flaky check is worse than no check — people learn to re-run it — and this
     * is *the* check guarding the lost-increment fix.
     *
     * Polling also keeps the assertion honest: it converges to exactly `expected`
     * and stops. It cannot pass by overshooting.
     */
    const DEADLINE_MS = 20_000;
    const started = Date.now();
    let count = null;

    while (Date.now() - started < DEADLINE_MS) {
      const { body } = await json("/api/links/my-links", { token });
      count = body?.data?.find((l) => l.urlCode === code)?.clickCount ?? null;
      if (count === expected) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    const waited = Date.now() - started;

    // The old read-modify-write (read → clickCount++ → save) dropped increments
    // here: two concurrent clicks read the same value and one write was lost. No
    // amount of waiting recovers those, so a timeout is a genuine failure.
    check(
      `${CLICKS} concurrent clicks are all counted (expected ${expected})`,
      count === expected,
      `got ${count} after ${waited}ms`,
    );
  }

  // ---- analytics ---------------------------------------------------------
  section("analytics");
  {
    const { status, body } = await json("/api/links/clicks-by-day?days=7", { token });
    check("clicks-by-day → 200", status === 200, `got ${status}`);
    check("returns 7 days", body?.data?.length === 7, `got ${body?.data?.length}`);
    // generate_series zero-fills, so quiet days are present rather than missing.
    check("days with no clicks are zero-filled", body?.data?.every((d) => typeof d.count === "number"));
    check("today has clicks", body?.data?.at(-1)?.count > 0, `got ${body?.data?.at(-1)?.count}`);

    const clamped = await json("/api/links/clicks-by-day?days=99999", { token });
    check("out-of-range days is clamped, not rejected", clamped.status === 200, `got ${clamped.status}`);
    check("clamped to 90 days", clamped.body?.data?.length === 90, `got ${clamped.body?.data?.length}`);
  }

  // ---- pagination --------------------------------------------------------
  section("pagination");
  {
    // Enough links to need three pages at a size of 5.
    const made = [];
    for (let i = 0; i < 12; i++) {
      const { body } = await json("/api/shorten", {
        method: "POST",
        token,
        body: JSON.stringify({ longUrl: `https://example.com/page/${Date.now()}/${i}` }),
      });
      made.push(body?.data?.url?.urlCode);
    }

    const seen = [];
    let cursor = null;
    let pages = 0;

    do {
      const query = `?limit=5${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const { body } = await json(`/api/links/my-links${query}`, { token });
      seen.push(...(body?.data ?? []).map((l) => l.urlCode));
      cursor = body?.nextCursor ?? null;
      pages++;
    } while (cursor && pages < 20);

    check("paginates rather than returning everything", pages > 1, `${pages} page(s)`);
    check("no row appears twice across pages", new Set(seen).size === seen.length);
    check(
      "every link created is reachable by paging",
      made.every((code) => seen.includes(code)),
    );

    // Keyset pagination survives writes mid-scroll; offset pagination does not.
    const garbage = await json("/api/links/my-links?cursor=not-a-real-cursor", { token });
    check(
      "a malformed cursor serves page one rather than a 500",
      garbage.status === 200,
      `got ${garbage.status}`,
    );
  }

  // ---- delete and repoint -------------------------------------------------
  section("delete and repoint");
  {
    const target = `https://example.com/editme/${Date.now()}`;
    const { body: created } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl: target }),
    });
    const editCode = created?.data?.url?.urlCode;

    // Warm the cache — this is what makes the eviction check meaningful.
    await fetch(`${BASE}/${editCode}`, { redirect: "manual" });

    const repointed = await json(`/api/links/${editCode}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ longUrl: "https://example.com/repointed" }),
    });
    check("PATCH repoints a link → 200", repointed.status === 200, `got ${repointed.status}`);

    const afterEdit = await fetch(`${BASE}/${editCode}`, { redirect: "manual" });
    // If the cache isn't evicted on write, this still points at the old target
    // for a full TTL — the owner watches their edit do nothing.
    check(
      "the redirect follows the new destination (cache evicted)",
      afterEdit.headers.get("location") === "https://example.com/repointed",
      `got ${afterEdit.headers.get("location")}`,
    );

    // Editing must re-run the validation chain. Otherwise: shorten something
    // harmless, then edit it into javascript: — straight through every rule.
    const evil = await json(`/api/links/${editCode}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ longUrl: "javascript:alert(1)" }),
    });
    check("PATCH re-runs the validation chain → 400", evil.status === 400, `got ${evil.status}`);

    // A second account must not be able to touch it — and must be told "not
    // found", not "forbidden": a 403 confirms the link exists.
    const otherEmail = `smoke-other-${Date.now()}@example.test`;
    const { body: otherBody } = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Other", email: otherEmail, password }),
    });
    const otherToken = otherBody?.token;

    const stolen = await json(`/api/links/${editCode}`, {
      method: "DELETE",
      token: otherToken,
    });
    check("deleting someone else's link → 404, not 403", stolen.status === 404, `got ${stolen.status}`);

    const survived = await fetch(`${BASE}/${editCode}`, { redirect: "manual" });
    check("and the link still works", survived.status === 302, `got ${survived.status}`);

    const gone = await json(`/api/links/${editCode}`, { method: "DELETE", token });
    check("DELETE own link → 200", gone.status === 200, `got ${gone.status}`);

    const dead = await fetch(`${BASE}/${editCode}`, { redirect: "manual" });
    check(
      "the redirect stops working immediately (cache evicted)",
      dead.status === 404,
      `got ${dead.status}`,
    );
  }

  // ---- rate limiting ------------------------------------------------------
  section("rate limiting");
  {
    /**
     * A FRESH user, on purpose. Buckets are keyed by user id, so hammering this
     * one leaves the main test's budget untouched — which is the only reason the
     * two can coexist in one run.
     */
    const rlEmail = `smoke-rl-${Date.now()}@example.test`;
    const { body: rlBody } = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "RL", email: rlEmail, password }),
    });
    const rlToken = rlBody?.token;

    const first = await json("/api/shorten", {
      method: "POST",
      token: rlToken,
      body: JSON.stringify({ longUrl: "https://example.com/rl/0" }),
    });

    const limit = Number(first.headers.get("RateLimit-Limit"));

    check("RateLimit-Limit header is sent", Number.isFinite(limit) && limit > 0, `got ${limit}`);
    check(
      "RateLimit-Remaining is sent and below the limit",
      Number(first.headers.get("RateLimit-Remaining")) < limit,
    );

    // Spend the rest of the bucket, then one more. The requests are deliberately
    // invalid URLs: the limiter runs *before* the handler, so each still costs a
    // token, but nothing is written and the loop stays fast.
    let allowed = 1;
    let blocked = 0;
    let retryAfter = null;

    for (let i = 0; i < limit + 3; i++) {
      const res = await json("/api/shorten", {
        method: "POST",
        token: rlToken,
        body: JSON.stringify({ longUrl: "not-a-url" }),
      });

      if (res.status === 429) {
        blocked++;
        retryAfter ??= res.headers.get("Retry-After");
      } else {
        allowed++;
      }
    }

    check(
      `the bucket holds exactly ${limit} tokens`,
      allowed === limit,
      `${allowed} allowed, ${blocked} blocked`,
    );
    check("an exhausted bucket returns 429", blocked > 0);
    check("429 carries Retry-After", Number(retryAfter) > 0, `got ${retryAfter}`);

    // The redirect is the product. Throttling it would mean throttling the very
    // success the app exists to produce.
    const { body: hot } = await json("/api/shorten", {
      method: "POST",
      token,
      body: JSON.stringify({ longUrl: `https://example.com/hot/${Date.now()}` }),
    });
    const hotCode = hot?.data?.url?.urlCode;

    const statuses = await Promise.all(
      Array.from({ length: 80 }, () =>
        fetch(`${BASE}/${hotCode}`, { redirect: "manual" }).then((r) => r.status),
      ),
    );
    check(
      "redirects are never rate limited",
      statuses.every((s) => s === 302),
      `${statuses.filter((s) => s === 429).length} were 429`,
    );
  }

  // ---- error hygiene -----------------------------------------------------
  section("error hygiene");
  {
    const { body } = await json("/api/shorten", {
      method: "POST",
      body: JSON.stringify({ longUrl: "javascript:alert(1)" }),
    });
    if (process.env.NODE_ENV === "production") {
      check("no stack trace leaked in production", !("stack" in (body ?? {})));
    } else {
      check("4xx echoes a usable message", typeof body?.message === "string" && body.message.length > 0);
    }
  }

  // ---- result ------------------------------------------------------------
  console.log(`\n${"─".repeat(50)}`);
  if (failures.length) {
    console.log(`✗ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log(`✓ all ${passed} checks passed`);
}

run().catch((err) => {
  console.error(`\nSmoke test crashed: ${err.message}`);
  process.exit(1);
});
