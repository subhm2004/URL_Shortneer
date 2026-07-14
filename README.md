<div align="center">

<img src=".github/assets/header.svg" width="100%" alt="Trunc — a POST to /api/shorten passing through the validation chain, the short-code strategy, the repository, and the event bus, returning url_code Yw3dcSQK" />

<br />

**A URL shortener with click analytics, a private dashboard, and an MCP server —
so your AI assistant can shorten links and read your stats from a conversation.**

`Postgres` · `Express` · `React` · `MCP`

[![CI](https://github.com/subhm2004/URL_Shortneer/actions/workflows/ci.yml/badge.svg)](https://github.com/subhm2004/URL_Shortneer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-111111.svg?style=flat-square)](https://nodejs.org)
[![Postgres](https://img.shields.io/badge/postgres-14%2B-111111.svg?style=flat-square)](https://postgresql.org)
[![Patterns](https://img.shields.io/badge/design%20patterns-12-111111.svg?style=flat-square)](#design-patterns)

</div>

---

Most shorteners hide the machinery. Trunc shows it to you: paste a URL on the
landing page and every layer the request passes through lights up, in order, as
the real request runs.

**That header isn't decoration.** It's the actual request path — the same four
layers, in the same order, that a real `POST /api/shorten` goes through. The rest
of this README explains every one of them.

---

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [**Design patterns**](#design-patterns) — the 12, with the code
- [What the rewrite fixed](#what-the-rewrite-fixed)
- [API](#api)
- [MCP server](#mcp-server)
- [Configuration](#configuration)
- [Project layout](#project-layout)

---

## Quick start

**You need:** Node 18+, and a Postgres connection string — [Neon](https://neon.tech),
[Supabase](https://supabase.com), Railway, or a local Postgres. Any of them.

```bash
# ---- backend ----
cd app
npm install
cp .env.example .env
```

Open `app/.env` and fill in two values:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require   # ← your Postgres
JWT_SECRET=                                                    # ← see below
```

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then start it:

```bash
npm run dev            # → http://localhost:5050
```

The tables are created on first boot — migrations run automatically. (To run them
by hand: `npm run migrate`.)

```bash
# ---- frontend (new terminal) ----
cd frontend
npm install
npm run dev            # → http://localhost:3000
```

Open **http://localhost:3000** and shorten something.

> The frontend proxies `/api` to the backend in development (see
> `frontend/next.config.ts`), so the browser makes same-origin requests and CORS
> never enters the picture locally.

> [!NOTE]
> **The backend runs on 5050, not 5000.** On macOS, port 5000 is held by the
> AirPlay Receiver, which accepts connections and silently swallows them — you get
> empty responses with no error anywhere. Either leave the port alone, or turn
> AirPlay Receiver off in *System Settings → General → AirDrop & Handoff*.

### With Docker

```bash
make up          # uses the DATABASE_URL in your root .env (e.g. Neon)
make up-local    # runs a Postgres container too — no external DB needed
```

| | |
|---|---|
| `make logs` | Follow logs |
| `make down` | Stop everything |
| `make psql` | psql shell (local-db only) |
| `make reset` | Stop **and delete** the local DB volume |

---

## Architecture

Requests only ever call *downward*. Every class receives its collaborators through
its constructor and imports none of them — that's what makes them testable without
a database, and what lets the cache be swapped for Redis by editing one line.

```
                          ┌──────────────┐
   HTTP request  ────────▶│   routes/    │  auth middleware, nothing else
                          └──────┬───────┘
                                 ▼
                          ┌──────────────┐
                          │ controllers/ │  transport only: read → call → shape
                          └──────┬───────┘
                                 ▼
                          ┌──────────────┐
                          │  services/   │  the business logic
                          └──────┬───────┘  knows nothing of HTTP or SQL
                                 ▼
                          ┌──────────────┐
                          │repositories/ │  all the SQL lives here
                          └──────┬───────┘  nothing above imports a DB driver
                                 ▼
                          ┌──────────────┐
                          │     db/      │  pool + migrations
                          └──────────────┘

   core/          errors · logger · response builder · event bus
   strategies/    short-code generation (swappable at runtime)
   validation/    the URL rule chain
   observers/     side-effects of a click — run after the response is sent
   container.js   the composition root: the one file that wires it all together
```

### The three tables

```sql
users   (id, name, email, password_hash, created_at)
urls    (id, url_code UNIQUE, long_url, user_id, click_count, created_at)
clicks  (id, url_id, clicked_at, referer, user_agent)
```

Clicks live in their own table, **not** in an array on the URL row. An array grows
the row on every single click, eventually hits Postgres' tuple limits, and can't be
aggregated in SQL without unnesting it first.

---

## Design patterns

**Twelve patterns, and every one of them is load-bearing.**

None were added to pad a list. Each is here because something in this codebase was
hard to change, unsafe, or slow without it. The code for each is below — read the
*"without it"* line first, because that's the whole argument.

| # | Pattern | Where | Without it |
|:--|:--|:--|:--|
| [01](#01--singleton) | **Singleton** | `config/` · `db/pool.js` · `core/logger.js` | A connection pool per request, exhausting Postgres' limit |
| [02](#02--repository) | **Repository** | `repositories/` | SQL smeared through the business logic |
| [03](#03--template-method) | **Template Method** | `BaseRepository` | Every repository re-implementing connection handling |
| [04](#04--decorator) | **Decorator** | `CachedUrlRepository` | Cache checks tangled into the service that uses it |
| [05](#05--null-object) | **Null Object** | `NullCache` | `if (cache)` at every call site — where cache bugs come from |
| [06](#06--strategy) | **Strategy** | `strategies/shortcode/` | `nanoid(8)` hardcoded in the middle of a controller |
| [07](#07--factory) | **Factory** | `ShortCodeStrategyFactory` | Every caller knowing the concrete class names |
| [08](#08--chain-of-responsibility) | **Chain of Responsibility** | `validation/` | One long `if/else` that nobody dares reorder |
| [09](#09--observer) | **Observer** | `core/EventBus` | Every visitor waiting on a DB write before being redirected |
| [10](#10--builder) | **Builder** | `core/ApiResponse` | Five hand-rolled response shapes that drifted apart |
| [11](#11--dependency-injection) | **Dependency Injection** | `container.js` | Unit tests that need a live database |
| [12](#12--facade) | **Facade** | `frontend/src/lib/api.ts` | The same twenty lines of `fetch` in three files |

---

### 01 · Singleton

*Config, the Postgres pool, and the logger are each created once per process.*

```js
// app/db/pool.js
let pool = null;

export function getPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.db.connectionString,
    ssl: config.db.ssl,
    max: config.db.max,
  });

  return pool;
}
```

**Why it earns its place.** A `Pool` opens and reuses TCP connections. Creating one
per request would open a fresh connection every time and blow through Postgres'
connection limit under any real traffic — on Neon's free tier, within seconds.

The config Singleton does something subtler: it reads and **validates the whole
environment at boot**, so a missing `DATABASE_URL` fails on startup rather than on
the first request unlucky enough to need it.

```js
// app/config/index.js
export function assertConfigValid() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}
```

---

### 02 · Repository

*All SQL lives behind an interface. No service imports `pg`.*

```js
// app/repositories/UrlRepository.js
export default class UrlRepository extends BaseRepository {
  findByCode(urlCode) {
    return this.one(`SELECT * FROM urls WHERE url_code = $1`, [urlCode]);
  }

  create({ urlCode, longUrl, userId = null }) {
    return this.one(
      `INSERT INTO urls (url_code, long_url, user_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [urlCode, longUrl, userId],
    );
  }
}
```

**Why it earns its place.** `UrlService` asks for *a URL by its code*. It doesn't
know there's a table, or a `SELECT`, or Postgres at all. That boundary is what makes
the service testable with a fake repository — and it's what made migrating this app
from MongoDB to Postgres a rewrite of one directory instead of the whole codebase.

The repository also maps `snake_case` rows to domain objects, so nothing above this
layer has to know the database's naming convention:

```js
toDomain(row) {
  return {
    id: row.id,
    urlCode: row.url_code,
    longUrl: row.long_url,
    shortUrl: `${config.baseUrl}/${row.url_code}`,   // derived, never stored
    clickCount: row.click_count,
    createdAt: row.created_at,
  };
}
```

> `shortUrl` is **derived from config, not stored.** The old schema persisted the
> full short URL on every row — so moving the app to a new domain silently broke
> every link ever created. Deriving it means `BASE_URL` is the single source of truth.

---

### 03 · Template Method

*`BaseRepository` owns the plumbing; subclasses declare only what's specific to them.*

```js
// app/repositories/BaseRepository.js
export default class BaseRepository {
  toDomain(row) { return row; }          // ← subclasses override this

  async one(text, params = []) {
    const { rows } = await this.query(text, params);
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async withTransaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const scoped = new this.constructor(client);   // same repo, bound to this client
      const result = await fn(scoped, client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
```

**Why it earns its place.** Connection checkout, `BEGIN`/`COMMIT`/`ROLLBACK`, and
releasing the client back to the pool are easy to get subtly wrong — a missed
`client.release()` leaks a connection, and you find out days later when the pool
runs dry. Writing it once means the four repositories can't each get it wrong in
their own way.

---

### 04 · Decorator

*Adds caching to the redirect lookup without a single service knowing it exists.*

```js
// app/repositories/CachedUrlRepository.js
export default class CachedUrlRepository {
  async findByCode(urlCode) {
    const key = `code:${urlCode}`;

    const hit = this.#cache.get(key);
    if (hit !== undefined) {
      logger.debug("Cache hit", { urlCode });
      return hit;
    }

    const url = await this.#inner.findByCode(urlCode);

    // Misses are cached too (as null). Otherwise a bot hammering nonexistent
    // codes would hit Postgres on every request.
    this.#cache.set(key, url);
    return url;
  }

  // everything else forwards straight through
  findByUser(userId)   { return this.#inner.findByUser(userId); }
  statsForUser(userId) { return this.#inner.statsForUser(userId); }
}
```

It implements the same interface as the thing it wraps, so this is the *only* line
that changes to turn caching on:

```js
// app/container.js
const urlRepository = new CachedUrlRepository(new UrlRepository(), cache);
```

**Why it earns its place.** Every single redirect performs `findByCode`. That's the
hot path. Caching it is worth real latency — but the alternative implementation is
cache checks smeared through `UrlService`, which is exactly how you end up serving
stale data and not knowing why.

Note what it deliberately does **not** cache: `findByLongUrlAndUser`, which runs on
the *write* path, where a stale answer would mean minting a duplicate row.

---

### 05 · Null Object

*A cache that never caches.*

```js
// app/cache/NullCache.js
export default class NullCache {
  get()    { return undefined; }   // always a miss
  set()    {}                      // forget immediately
  delete() {}
}
```

```js
// app/container.js
const cache = config.cache.enabled
  ? new InMemoryCache({ maxEntries: 1000, ttlMs: 60_000 })
  : new NullCache();
```

**Why it earns its place.** The alternative is `if (this.cache)` guarding every read
and every write inside the decorator. That's four branches that all have to be right,
and cache bugs live in exactly those branches. With a Null Object, `CACHE_ENABLED=false`
is a *different object*, not a different code path.

---

### 06 · Strategy

*How a short code is minted is a runtime choice, not a hardcoded call.*

Before, this sat in the middle of a controller:

```js
const urlCode = nanoid(8);                    // ← the old code
```

Now it's an interface with three implementations:

```js
// app/strategies/shortcode/NanoIdStrategy.js
export default class NanoIdStrategy extends ShortCodeStrategy {
  get name() { return "nanoid"; }
  generate() { return this.#generate(); }
}
```

```js
// app/strategies/shortcode/CustomAliasStrategy.js
export default class CustomAliasStrategy extends ShortCodeStrategy {
  generate(context = {}) {
    const alias = context.customAlias?.trim();
    if (!alias) return this.#fallback.generate(context);   // no alias → delegate

    if (!ALIAS_PATTERN.test(alias)) {
      throw new ValidationError("A custom alias must be 3–32 characters…");
    }
    if (RESERVED.has(alias.toLowerCase())) {
      throw new ValidationError(`"${alias}" is a reserved word — pick another alias.`);
    }
    return alias;
  }
}
```

Swap the algorithm for the entire app with one environment variable:

```bash
SHORT_CODE_STRATEGY=base62     # nanoid | base62
```

**Why it earns its place.** Not one line of `UrlService` changes. That's the test of
whether a seam is real, and this one passes it.

There's a design detail worth noticing: `CustomAliasStrategy` can **fail**, because
an alias is user input — it's *validated*, not generated. The random strategies never
fail. That asymmetry is precisely why generation had to become an interface: the
caller just asks for a code and handles the error, without knowing which strategy
produced it.

> The nanoid alphabet drops `0`/`O` and `1`/`l`/`I` — so a code survives being read
> aloud over a phone. Codes are also random, not sequential: you can't enumerate other
> people's links by counting up from your own.

---

### 07 · Factory

*The one place that knows the concrete strategy classes by name.*

```js
// app/strategies/shortcode/ShortCodeStrategyFactory.js
export default class ShortCodeStrategyFactory {
  static #registry = {
    nanoid: (opts) => new NanoIdStrategy(opts),
    base62: (opts) => new Base62Strategy(opts),
  };

  static create(name, options = {}) {
    const build = this.#registry[name];
    if (!build) {
      throw new Error(`Unknown SHORT_CODE_STRATEGY "${name}". Known: ${Object.keys(this.#registry)}`);
    }
    // Every strategy is wrapped, so any of them can accept a custom alias.
    return new CustomAliasStrategy(build(options));
  }
}
```

**Why it earns its place.** `SHORT_CODE_STRATEGY` is a *string* from the environment.
Something has to turn that string into an object, and if that logic lives at the call
site, every call site has to import every strategy. Adding a fourth algorithm is now
one line in this registry.

It also fails **loudly and early**: a typo in the env var throws at boot with a list
of valid names, instead of silently minting codes with the wrong generator.

---

### 08 · Chain of Responsibility

*Each URL rule rejects or passes along. The chain's order and membership are configuration.*

```js
// app/validation/UrlValidator.js
constructor({ baseUrl, maxLength = 2048 }) {
  const required = new RequiredRule();

  required
    .setNext(new MaxLengthRule(maxLength))
    .setNext(new ParsableRule())          // ← must run before the two below
    .setNext(new ProtocolRule())
    .setNext(new PublicHostRule())
    .setNext(new NoSelfReferenceRule(baseUrl));

  this.#head = required;
}
```

Each rule is small enough to be obviously correct:

```js
// app/validation/rules/urlRules.js
export class ProtocolRule extends ValidationRule {
  static ALLOWED = new Set(["http:", "https:"]);

  check(value, context) {
    if (!ProtocolRule.ALLOWED.has(context.parsed.protocol)) {
      throw new ValidationError("Only http:// and https:// URLs can be shortened.");
    }
    return value;
  }
}
```

**Why it earns its place — and this one is a security story.**

The old validator was a single `validUrl.isUri()` call. That function happily accepts:

| Input | What it actually is |
|:--|:--|
| `javascript:alert(1)` | **Stored XSS** in any client that renders the link |
| `http://169.254.169.254/` | The **cloud metadata endpoint** — an SSRF gadget wearing your domain |
| `http://localhost:5050/admin` | Anything on your own private network |

The chain enforces a protocol **allowlist** (a blocklist is the wrong shape for this
problem — you will always miss one) and refuses private, loopback and link-local
hosts. It also refuses self-referential short links, because two of them chained
together is a redirect loop.

Splitting the checks into named rules is what made those omissions *visible*. A
40-line `if/else` hides what it forgot; a list of six rule names does not.

---

### 09 · Observer

*The redirect responds immediately. The click is recorded afterwards.*

```js
// app/services/UrlService.js
async resolve({ urlCode, referer, userAgent }) {
  const url = await this.#urls.findByCode(urlCode);
  if (!url) throw new NotFoundError("That short link doesn't exist.");

  this.#events.publish(EVENTS.LINK_CLICKED, {
    urlId: url.id, urlCode: url.urlCode, referer, userAgent,
  });

  return url;      // ← does NOT wait for the click to be written
}
```

```js
// app/observers/clickObservers.js
eventBus.subscribe(EVENTS.LINK_CLICKED, async ({ urlId }) => {
  await urlRepository.incrementClickCount(urlId);
});

eventBus.subscribe(EVENTS.LINK_CLICKED, async ({ urlId, referer, userAgent }) => {
  await clickRepository.record({ urlId, referer, userAgent });
});
```

The bus defers subscribers to the next tick, so the response is already on the wire
before any of them run:

```js
// app/core/EventBus.js
publish(event, payload) {
  setImmediate(() => {
    try { super.emit(event, payload); }
    catch (err) { logger.error("Observer threw", { event, error: err.message }); }
  });
}
```

**Why it earns its place.** The old redirect handler `await`ed two database writes
before sending the 301. Every visitor to every link paid for our analytics, in
latency, on the one code path where latency is the entire product.

**The trade-off is real and deliberate:** a click can be lost if the process dies in
the ~1ms between `publish` and the write. For click *counts*, that is a fair price
for a redirect that doesn't wait. If this were payment events, the answer would be
different — and the pattern would still be the right one, just with a durable queue
behind it instead of `setImmediate`.

Adding a new side-effect of a click — a webhook, a geo-IP lookup, a rate-limit
counter — is now one `subscribe()` call, and the redirect path stays exactly as fast.

---

### 10 · Builder

*One response envelope, decided once.*

```js
// app/controllers/UrlController.js
return ApiResponse.created()
  .message("Short URL created.")
  .data({ url })
  .send(res);
```

```js
// app/controllers/LinkController.js
return ApiResponse.ok()
  .meta({ count: links.length })
  .data(links)
  .send(res);
```

**Why it earns its place.** Every endpoint used to hand-assemble its own object, and
they had **already drifted**: some had a `count`, some nested `data.url`, some
returned the array bare. The frontend had a different unwrapping ritual for each one.

Now the shape is one decision in one file, and `success` is *derived* from the status
code rather than typed by hand — so it can't disagree with the HTTP response:

```js
toJSON() {
  const body = { success: this.#status < 400 };   // derived, not asserted
  if (this.#message !== null) body.message = this.#message;
  Object.assign(body, this.#meta);
  if (this.#data !== undefined) body.data = this.#data;
  return body;
}
```

---

### 11 · Dependency Injection

*Every class takes its collaborators in. One file does the wiring.*

```js
// app/services/UrlService.js
constructor({ urlRepository, urlValidator, shortCodeStrategy, eventBus, config }) {
  this.#urls = urlRepository;
  this.#validator = urlValidator;
  this.#codeStrategy = shortCodeStrategy;
  this.#events = eventBus;
  this.#config = config;
}
```

Notice what `UrlService` **imports**: nothing. Not the repository, not the validator,
not the database. It can't reach for a global even if it wanted to.

The wiring lives in exactly one place — the composition root:

```js
// app/container.js
export function buildContainer() {
  const cache = config.cache.enabled ? new InMemoryCache({...}) : new NullCache();

  const urlRepository = new CachedUrlRepository(new UrlRepository(), cache);
  const shortCodeStrategy = ShortCodeStrategyFactory.create(config.shortCode.strategy);
  const urlValidator = new UrlValidator({ baseUrl: config.baseUrl });

  const urlService = new UrlService({
    urlRepository, urlValidator, shortCodeStrategy, eventBus, config,
  });

  return { services: { urlService, ... }, controllers: { ... } };
}
```

**Why it earns its place.** This is the pattern that makes the other eleven *usable*.
A unit test for `UrlService` hands it a fake repository and a fake clock — no
Postgres, no Express, no network. Swapping `InMemoryCache` for Redis is one line
here, and nothing downstream notices.

The honest cost: *something* has to do the wiring, and it's this file. That's the
trade — one explicit, readable graph, instead of `new` calls and module-level
singletons scattered across thirty files.

---

### 12 · Facade

*One entry point for every call the frontend makes to the backend.*

```ts
// frontend/src/lib/api.ts

/** "required" fails fast without a token; "optional" sends one if we have it. */
type Auth = "required" | "optional" | "none";

async function request<T>(
  path: string,
  { method = "GET", body, auth = "optional" }: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth !== "none") {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth === "required") throw new ApiError("You need to sign in first.", 401);
  }

  // …one place that fetches, parses JSON, checks res.ok, and throws a typed ApiError
}
```

Every call site collapses to one line, and the auth policy is part of the call:

```ts
// auth: "none" — a stale token must not ride along with a login attempt
export async function login(input: { email: string; password: string }) { … }

// anonymous shortening is a feature, so the token is optional here
export async function shorten(longUrl: string, customAlias?: string) { … }

export async function myLinks(): Promise<ShortUrl[]> {
  const res = await request<ShortUrl[]>("/api/links/my-links", { auth: "required" });
  return res.data ?? [];
}
```

**Why it earns its place.** The three service files each repeated the same twenty
lines — build URL, set `Content-Type`, attach the bearer token, `await res.json()`,
check `res.ok`, throw `new Error(data.message || "…")`, `console.error`, rethrow.

And they had **already drifted**: only two of the three sent the token at all, and
each invented its own fallback error message. That's the failure mode this pattern
exists to prevent — not verbosity, but *divergence*.

The old signatures also took a `token` argument that every page had to thread down
from `AuthContext`. Now the pages don't handle credentials at all.

---

## What the rewrite fixed

Trunc started as a Mongoose app. These were real defects in it — each one now fixed
and **verified against a live Postgres**, not asserted in a README.

**`url_code` had no unique constraint.**
It's the redirect key. Two links could be handed the same generated code, and one of
them would send visitors to the wrong site. It's now `UNIQUE`, and the service retries
on collision rather than pre-checking — pre-checking races.

**Click counting lost increments under load.**
The redirect did read → `clickCount++` → `save()`. Two concurrent clicks both read the
same value; one increment vanished. It's now a single atomic statement:

```sql
UPDATE urls SET click_count = click_count + 1 WHERE id = $1
```

> **Verified: 50 concurrent requests → exactly 51 counted.**

**Analytics didn't scale.**
`clicks-by-day` loaded every URL row — each carrying its full array of click timestamps
— into Node, then counted them in a JS `Map`. That's O(every click ever) work and memory
on each dashboard load. It's now one SQL aggregation over a `generate_series` date
spine, which zero-fills empty days for free:

```sql
WITH spine AS (
  SELECT generate_series(current_date - make_interval(days => $2 - 1),
                         current_date, interval '1 day')::date AS day
)
SELECT to_char(spine.day, 'YYYY-MM-DD') AS date, count(c.id) AS count
  FROM spine
  LEFT JOIN urls u   ON u.user_id = $1
  LEFT JOIN clicks c ON c.url_id = u.id
                    AND c.clicked_at >= spine.day
                    AND c.clicked_at <  spine.day + interval '1 day'
 GROUP BY spine.day ORDER BY spine.day
```

**The URL validator accepted dangerous input.**
See [Chain of Responsibility](#08--chain-of-responsibility) — `javascript:` URLs and
the cloud metadata endpoint both sailed through.

**Auth was documented but not enforced.**
The old middleware called `next()` when no token was present, so `/api/shorten` was wide
open despite the docs, and every protected controller re-checked `if (!req.user)` by hand.
There are now two explicit middlewares, `requireAuth` and `optionalAuth`.

**The redirect was a 301.**
A 301 is cached by the browser *forever*, so every click after the first never reaches
the server. The count would freeze at 1, and the link could never be repointed. It's a
302 now.

---

## API

| Method | Endpoint | Auth | Description |
|:--|:--|:--|:--|
| `GET` | `/health` | — | Health check. |
| `POST` | `/api/auth/register` | — | Register. Returns a JWT so the client auto-logs in. |
| `POST` | `/api/auth/login` | — | Log in. Returns a JWT. |
| `POST` | `/api/shorten` | optional | Shorten a URL. Signed in → saved to your dashboard. Anonymous → still works. Takes an optional `customAlias`. |
| `GET` | `/:code` | — | Redirect (302) and record the click. |
| `GET` | `/api/links/my-links` | **required** | Your links. |
| `GET` | `/api/links/clicks-by-day?days=30` | **required** | Clicks per day (1–90). Zero-filled. |
| `GET` | `/api/links/overview` | **required** | Totals + your top 5 links. |

Every response uses the same envelope:

```jsonc
{ "success": true, "message": "Short URL created.", "data": { "url": { … } } }
```

4xx errors echo a clean message. 5xx errors return a generic one and never leak
internals — connection strings, table names and hostnames all live in 5xx messages.

---

## MCP server

Lets Claude Desktop (or any MCP client) drive the shortener. Two transports — stdio
and HTTP — sharing one tool surface. Every tool requires a JWT, issued by the web app.

| Tool | Description |
|:--|:--|
| `whoami` | Whether a JWT is visible to the server. |
| `shorten_url` | Shorten a URL. Supports `customAlias`. |
| `get_my_links` | List your links. |
| `get_clicks_by_day` | Clicks per day (1–90). |

The in-app guide at **`/mcp`** shows your JWT and a ready-to-paste client config.
Full docs: **[mcp-server/README.md](mcp-server/README.md)**.

---

## Configuration

`app/.env` — [`app/.env.example`](app/.env.example) has the annotated list.

| Variable | Default | Purpose |
|:--|:--|:--|
| `DATABASE_URL` | — | **Required.** Postgres connection string. TLS turns on automatically for non-local hosts. |
| `JWT_SECRET` | — | **Required.** Changing it invalidates every existing session. |
| `PORT` | `5050` | See the macOS note in [Quick start](#quick-start). |
| `BASE_URL` | `http://localhost:5050` | Origin short links are minted against. Short URLs are **derived** from this, not stored — so moving domains doesn't break existing links. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins, comma-separated. |
| `SHORT_CODE_STRATEGY` | `nanoid` | `nanoid` \| `base62` — see [Strategy](#06--strategy). |
| `SHORT_CODE_LENGTH` | `8` | |
| `CACHE_ENABLED` | `true` | The redirect-path cache. `false` injects the [`NullCache`](#05--null-object). |
| `LOG_LEVEL` | `debug` (dev) | `error` \| `warn` \| `info` \| `debug` |

---

## Project layout

```
app/                       Backend — Express + Postgres
  ├─ config/               Env parsing + validation          → Singleton
  ├─ core/
  │   ├─ errors.js         AppError hierarchy
  │   ├─ logger.js         Level-filtered, redacts secrets   → Singleton
  │   ├─ ApiResponse.js    Response envelope                 → Builder
  │   └─ EventBus.js       Publish/subscribe                 → Observer
  ├─ db/
  │   ├─ pool.js           Connection pool                   → Singleton
  │   ├─ migrate.js        Migration runner (advisory-locked)
  │   └─ migrations/       Plain SQL, applied in order
  ├─ cache/
  │   ├─ InMemoryCache.js  TTL + LRU
  │   └─ NullCache.js                                        → Null Object
  ├─ repositories/
  │   ├─ BaseRepository.js Query + transaction plumbing      → Template Method
  │   ├─ UserRepository.js                                   → Repository
  │   ├─ UrlRepository.js                                    → Repository
  │   ├─ ClickRepository.js                                  → Repository
  │   └─ CachedUrlRepository.js                              → Decorator
  ├─ strategies/shortcode/ NanoId · Base62 · CustomAlias     → Strategy + Factory
  ├─ validation/           The URL rule chain                → Chain of Responsibility
  ├─ services/             Auth · Url · Analytics
  ├─ observers/            Post-response side-effects
  ├─ controllers/          Transport only
  ├─ routes/               HTTP surface
  ├─ server.js             App factory
  └─ container.js          Composition root                  → Dependency Injection

frontend/                  Next.js 15 · TypeScript · Tailwind v4
  └─ src/
     ├─ app/               Landing · Dashboard · Login · Register · MCP guide
     ├─ components/
     │   ├─ Pipeline.tsx     The terminal — layers light up as the request runs
     │   ├─ ScrambleText.tsx The short code decrypting into place
     │   └─ Shortener.tsx    Form → pipeline → decrypted code → link
     ├─ context/           AuthProvider
     └─ lib/
         ├─ api.ts         One typed entry point to the API   → Facade
         └─ tokenStore.ts  The only module that knows where the JWT lives

mcp-server/                TypeScript — stdio + HTTP transports
```

---

## License

MIT.
