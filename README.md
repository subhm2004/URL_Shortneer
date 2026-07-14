<div align="center">

<img src=".github/assets/header.svg" width="100%" alt="Trunc — a POST to /api/shorten passing through the validation chain, the short-code strategy, the repository, and the event bus" />

<br />

**A URL shortener that shows you its own machinery.**

Paste a link and watch every layer of the request execute, in order, as it happens.
Then ask an AI assistant about your links — over MCP, the same protocol Claude Desktop speaks.

`PostgreSQL` · `Express` · `Next.js 15` · `TypeScript` · `MCP` · `Groq`

[![CI](https://github.com/subhm2004/URL_Shortneer/actions/workflows/ci.yml/badge.svg)](https://github.com/subhm2004/URL_Shortneer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-111111.svg?style=flat-square)](https://nodejs.org)
[![Postgres](https://img.shields.io/badge/postgres-14%2B-111111.svg?style=flat-square)](https://postgresql.org)
[![Design Patterns](https://img.shields.io/badge/design%20patterns-12-111111.svg?style=flat-square)](#design-patterns)

</div>

---

## Contents

- [What this is](#what-this-is)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [**Design patterns**](#design-patterns) — twelve, with the code and the reason
- [**MCP**](#mcp-model-context-protocol) — two clients, one protocol
- [The AI assistant](#the-ai-assistant)
- [Authentication](#authentication)
- [What the rewrite fixed](#what-the-rewrite-fixed)
- [API reference](#api-reference)
- [Testing and CI](#testing-and-ci)
- [**Deployment**](#deployment) — Render + Vercel + Neon
- [Configuration](#configuration)
- [Project layout](#project-layout)

---

## What this is

Most URL shorteners hide the machinery. Trunc shows it to you.

Paste a link on the landing page and a terminal prints the work as it happens —
the validation chain, the code generation, the database write, the event
dispatch. Not a mock: those are the layers the request actually passes through,
in the order it passes them.

It is also a **complete MCP integration**. The same four tools are reachable two
ways — from Claude Desktop over stdio or HTTP, and from a chat built into the app
itself, which is a genuine MCP client rather than a chat bolted on beside one.

Everything below is production-shaped: a layered backend, a typed frontend, real
migrations, real CI that spins up a Postgres and drives the API over HTTP, and
twelve design patterns that each exist because something was unsafe, slow, or
impossible to change without them.

---

## Architecture

### The system

```mermaid
graph TB
    subgraph Client
        Browser["🌐 Browser"]
        Claude["🤖 Claude Desktop"]
    end

    subgraph Vercel["▲ Vercel"]
        Next["Next.js 15<br/>App Router · TypeScript"]
        ChatAPI["/api/chat<br/>route handler — server only"]
    end

    subgraph Render["☁️ Render"]
        API["Express API<br/>redirects · auth · links"]
        MCP["MCP Server<br/>stdio + HTTP transports"]
    end

    subgraph External
        Neon[("🐘 Neon<br/>PostgreSQL")]
        Groq["⚡ Groq<br/>llama-3.3-70b"]
        Google["🔑 Google<br/>OAuth 2.0"]
    end

    Browser --> Next
    Browser -.->|"NEXT_PUBLIC_API_URL"| API
    Next --> ChatAPI
    ChatAPI -->|"tool calls · JSON-RPC"| MCP
    ChatAPI -->|"tool definitions"| Groq
    Claude -->|"MCP protocol"| MCP
    MCP -->|"SHORTENER_API_BASE"| API
    API --> Neon
    API <-->|"authorization code"| Google

    classDef vercel fill:#111,stroke:#666,color:#fff
    classDef render fill:#111,stroke:#666,color:#fff
    classDef ext fill:#0d0d0d,stroke:#37f712,color:#fff
    class Next,ChatAPI vercel
    class API,MCP render
    class Neon,Groq,Google ext
```

Note the two paths into the MCP server. **Claude Desktop and the in-app chat are
both MCP clients**, speaking the same protocol to the same endpoint, calling the
same tools. If one works and the other doesn't, that's a bug in the server — and
having both is how you find out.

### The backend, in layers

Requests only ever call *downward*. Every class receives its collaborators through
its constructor and imports none of them — which is what makes them testable
without a database, and what lets the cache be swapped for Redis by editing one
line.

```mermaid
graph TD
    R["routes/<br/>HTTP surface · auth middleware"]
    C["controllers/<br/>transport only — read, call, shape"]
    S["services/<br/>business logic · knows nothing of HTTP or SQL"]
    RE["repositories/<br/>all the SQL lives here"]
    DB["db/<br/>pool + migrations"]

    R --> C --> S --> RE --> DB

    CORE["core/<br/>errors · logger · ApiResponse · EventBus"]
    ST["strategies/<br/>short-code generation"]
    V["validation/<br/>the URL rule chain"]
    O["observers/<br/>post-response side-effects"]
    CT["container.js<br/><b>composition root</b>"]

    S -.-> CORE
    S -.-> ST
    S -.-> V
    S -.-> O
    CT -.->|"wires everything"| S

    classDef layer fill:#111,stroke:#37f712,color:#fff
    classDef support fill:#0d0d0d,stroke:#444,color:#aaa
    class R,C,S,RE,DB layer
    class CORE,ST,V,O,CT support
```

**Nothing above `repositories/` imports a database driver.** That boundary is why
migrating this app from MongoDB to PostgreSQL rewrote one directory rather than
the whole codebase.

### What happens when you shorten a link

This is the sequence the landing page animates — and it is the real one.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant C as UrlController
    participant S as UrlService
    participant V as UrlValidator<br/>chain of responsibility
    participant G as ShortCodeStrategy<br/>strategy + factory
    participant R as UrlRepository<br/>repository + decorator
    participant E as EventBus<br/>observer
    participant P as PostgreSQL

    B->>C: POST /api/shorten
    C->>S: shorten({ longUrl, userId })

    S->>V: validate(longUrl)
    Note over V: Required → MaxLength → Parsable<br/>→ Protocol → PublicHost → NoSelfRef
    V-->>S: normalised url

    S->>G: generate()
    G-->>S: "Yw3dcSQK"

    S->>R: create({ urlCode, longUrl })
    R->>P: INSERT INTO urls
    Note over P: unique(url_code) arbitrates<br/>collisions — service retries
    P-->>R: row
    R-->>S: url

    S->>E: publish(link.created)
    S-->>C: { url, created: true }
    C-->>B: 201 { url }

    Note over E,P: observers run AFTER the response.<br/>The caller never waits on them.
```

That last note is the point of the Observer seam. The old code awaited two
database writes before sending the redirect — every visitor to every link paid for
our analytics, on the one code path where latency *is* the product.

### The data model

```mermaid
erDiagram
    USERS ||--o{ URLS : owns
    URLS ||--o{ CLICKS : receives

    USERS {
        uuid id PK
        text name
        text email UK "unique on lower(email)"
        text password_hash "NULL for Google accounts"
        text google_id UK "Google's sub — never the email"
        text avatar_url
        timestamptz created_at
    }

    URLS {
        uuid id PK
        text url_code UK "the redirect key — UNIQUE"
        text long_url
        uuid user_id FK "NULL for anonymous"
        bigint click_count "atomic increment"
        timestamptz created_at
    }

    CLICKS {
        bigserial id PK
        uuid url_id FK
        timestamptz clicked_at
        text referer
        text user_agent
    }
```

Three decisions worth defending:

- **`url_code` is `UNIQUE`.** It is the redirect key. Without the constraint, two
  links could be handed the same generated code and one of them would send
  visitors to the wrong site.
- **Clicks are their own table**, not an array on the URL row. An array grows the
  row on every single click, eventually hits Postgres' tuple limits, and cannot be
  aggregated in SQL without unnesting it first.
- **`google_id` keys on Google's `sub`, never the email.** A Google user can change
  their email address; keying on it would either lose them their account or hand it
  to whoever later picks up their old address.

---

## Quick start

**You need:** Node 20+, and a PostgreSQL connection string — [Neon](https://neon.tech),
[Supabase](https://supabase.com), Railway, or a local Postgres. Any of them.

### 1. Backend

```bash
cd app
npm install
cp .env.example .env
```

Fill in two values in `app/.env`:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=            # generate one:
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
npm run dev            # → http://localhost:5050
```

Tables are created on first boot — migrations run automatically. (By hand:
`npm run migrate`.)

> [!NOTE]
> **The backend runs on 5050, not 5000.** On macOS, port 5000 is held by the AirPlay
> Receiver, which accepts connections and silently swallows them — you get empty
> responses with no error anywhere. Leave the port alone, or turn AirPlay Receiver
> off in *System Settings → General → AirDrop & Handoff*.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev            # → http://localhost:3000
```

Open **http://localhost:3000** and shorten something.

> `NEXT_PUBLIC_API_URL` is deliberately **unset** in development. The browser then
> fetches the relative path `/api/…` — same origin — and `next.config.ts` forwards
> it to the backend. Nothing crosses an origin, so CORS never enters the picture
> locally. See [Configuration](#configuration) for why production is different.

### 3. MCP server (optional)

```bash
cd mcp-server
npm install
cp .env.example .env
npm run dev:http       # → http://localhost:3001/mcp
```

Needed for the in-app assistant and for connecting Claude Desktop.

### With Docker

```bash
make up          # uses DATABASE_URL from the root .env (e.g. Neon)
make up-local    # runs a Postgres container too — no external DB needed
```

| | |
|---|---|
| `make logs` | Follow logs |
| `make down` | Stop everything |
| `make psql` | psql shell (local-db only) |
| `make reset` | Stop **and delete** the local DB volume |

---

## Design patterns

**Twelve patterns. Every one of them load-bearing.**

Most projects list design patterns like trophies. These are here because specific
things were unsafe, slow, or impossible to change without them — and the code says
which. Read the *"without it"* column first, because that's the whole argument.

| # | Pattern | Where | Without it |
|:--|:--|:--|:--|
| 01 | [**Singleton**](#01--singleton) | `config/` · `db/pool.js` · `core/logger.js` | A connection pool per request, exhausting Postgres' limit |
| 02 | [**Repository**](#02--repository) | `repositories/` | SQL smeared through the business logic |
| 03 | [**Template Method**](#03--template-method) | `BaseRepository` | Every repository re-implementing connection handling |
| 04 | [**Decorator**](#04--decorator) | `CachedUrlRepository` | Cache checks tangled into the service that uses it |
| 05 | [**Null Object**](#05--null-object) | `NullCache` | `if (cache)` at every call site — where cache bugs come from |
| 06 | [**Strategy**](#06--strategy) | `strategies/shortcode/` | `nanoid(8)` hardcoded in the middle of a controller |
| 07 | [**Factory**](#07--factory) | `ShortCodeStrategyFactory` | Every caller knowing the concrete class names |
| 08 | [**Chain of Responsibility**](#08--chain-of-responsibility) | `validation/` | One long `if/else` that nobody dares reorder |
| 09 | [**Observer**](#09--observer) | `core/EventBus` | Every visitor waiting on a DB write before being redirected |
| 10 | [**Builder**](#10--builder) | `core/ApiResponse` | Five hand-rolled response shapes that drifted apart |
| 11 | [**Dependency Injection**](#11--dependency-injection) | `container.js` | Unit tests that need a live database |
| 12 | [**Facade**](#12--facade) | `frontend/src/lib/api.ts` | The same twenty lines of `fetch` in three files |

---

### 01 · Singleton

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

**Why.** A `Pool` opens and reuses TCP connections. One per request would open a
fresh connection every time and blow through Postgres' connection limit under any
real traffic — on Neon's free tier, within seconds.

The config Singleton does something subtler: it validates the **whole environment
at boot**, so a missing `DATABASE_URL` fails on startup rather than on the first
request unlucky enough to need it.

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

```js
// app/repositories/UrlRepository.js
export default class UrlRepository extends BaseRepository {
  findByCode(urlCode) {
    return this.one(`SELECT * FROM urls WHERE url_code = $1`, [urlCode]);
  }

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
}
```

**Why.** `UrlService` asks for *a URL by its code*. It doesn't know there's a
table, or a `SELECT`, or Postgres at all. That boundary is what makes the service
testable with a fake repository — and it's why moving this app off MongoDB rewrote
one directory instead of the whole codebase.

> `shortUrl` is **derived from config, not stored**. The old schema persisted the
> full short URL on every row — so moving the app to a new domain silently broke
> every link ever created.

---

### 03 · Template Method

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

**Why.** Connection checkout, `BEGIN`/`COMMIT`/`ROLLBACK`, and releasing the client
are easy to get subtly wrong — a missed `client.release()` leaks a connection and
you find out days later when the pool runs dry. Writing it once means four
repositories can't each get it wrong in their own way.

---

### 04 · Decorator

```js
// app/repositories/CachedUrlRepository.js
export default class CachedUrlRepository {
  async findByCode(urlCode) {
    const key = `code:${urlCode}`;

    const hit = this.#cache.get(key);
    if (hit !== undefined) return hit;

    const url = await this.#inner.findByCode(urlCode);

    // Misses are cached too (as null) — otherwise a bot hammering nonexistent
    // codes would hit Postgres on every request.
    this.#cache.set(key, url);
    return url;
  }

  // everything else forwards straight through
  findByUser(userId) { return this.#inner.findByUser(userId); }
}
```

It implements the same interface as the thing it wraps, so this is the **only**
line that changes to turn caching on:

```js
// app/container.js
const urlRepository = new CachedUrlRepository(new UrlRepository(), cache);
```

**Why.** Every redirect performs `findByCode` — that's the hot path. The
alternative is cache checks smeared through `UrlService`, which is exactly how you
end up serving stale data and not knowing why.

Note what it deliberately does **not** cache: `findByLongUrlAndUser`, which runs on
the *write* path, where a stale answer would mean minting a duplicate row.

---

### 05 · Null Object

```js
// app/cache/NullCache.js
export default class NullCache {
  get()    { return undefined; }   // always a miss
  set()    {}                      // forget immediately
  delete() {}
}
```

```js
const cache = config.cache.enabled
  ? new InMemoryCache({ maxEntries: 1000, ttlMs: 60_000 })
  : new NullCache();
```

**Why.** The alternative is `if (this.cache)` guarding every read and every write
inside the decorator — four branches that all have to be right, and cache bugs live
in exactly those branches. With a Null Object, `CACHE_ENABLED=false` is a *different
object*, not a different code path.

---

### 06 · Strategy

Before, this sat in the middle of a controller:

```js
const urlCode = nanoid(8);                    // ← the old code
```

Now it's an interface with three implementations:

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

**Why.** Not one line of `UrlService` changes. That's the test of whether a seam is
real, and this one passes it.

There's a design detail worth noticing: `CustomAliasStrategy` can **fail**, because
an alias is user input — it is *validated*, not generated. The random strategies
never fail. That asymmetry is precisely why generation had to become an interface:
the caller just asks for a code and handles the error, without knowing which
strategy produced it.

> The reserved-word list is not decoration. A link at `/api` or `/login` would be
> shadowed by the router and **unreachable** — the alias would exist and never work.

---

### 07 · Factory

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

**Why.** `SHORT_CODE_STRATEGY` is a *string* from the environment. Something has to
turn it into an object, and if that logic lives at the call site, every call site
has to import every strategy. Adding a fourth algorithm is one line here.

It also fails **loudly and early**: a typo in the env var throws at boot with a list
of valid names, instead of silently minting codes with the wrong generator.

---

### 08 · Chain of Responsibility

```js
// app/validation/UrlValidator.js
const required = new RequiredRule();

required
  .setNext(new MaxLengthRule(maxLength))
  .setNext(new ParsableRule())          // ← must run before the two below
  .setNext(new ProtocolRule())
  .setNext(new PublicHostRule())
  .setNext(new NoSelfReferenceRule(baseUrl));
```

Each rule is small enough to be obviously correct:

```js
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

**Why — and this one is a security story.**

The old validator was a single `validUrl.isUri()` call. That function happily
accepts:

| Input | What it actually is |
|:--|:--|
| `javascript:alert(1)` | **Stored XSS** in any client that renders the link |
| `http://169.254.169.254/` | The **cloud metadata endpoint** — an SSRF gadget wearing your domain |
| `http://localhost:5050/admin` | Anything on your own private network |

The chain enforces a protocol **allowlist** (a blocklist is the wrong shape — you
will always miss one) and refuses private, loopback and link-local hosts. It also
refuses self-referential short links, because two chained together is a redirect
loop.

Splitting the checks into named rules is what made those omissions *visible*. A
forty-line `if/else` hides what it forgot; a list of six rule names does not.

---

### 09 · Observer

```js
// app/services/UrlService.js
async resolve({ urlCode, referer, userAgent }) {
  const url = await this.#urls.findByCode(urlCode);
  if (!url) throw new NotFoundError("That short link doesn't exist.");

  this.#events.publish(EVENTS.LINK_CLICKED, { urlId: url.id, referer, userAgent });

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
publish(event, payload) {
  setImmediate(() => {
    try { super.emit(event, payload); }
    catch (err) { logger.error("Observer threw", { event, error: err.message }); }
  });
}
```

**Why.** The old redirect handler `await`ed two database writes before sending the
301. Every visitor to every link paid for our analytics, in latency, on the one code
path where latency is the entire product.

**The trade-off is real and deliberate:** a click can be lost if the process dies in
the ~1ms between `publish` and the write. For click *counts*, that is a fair price
for a redirect that doesn't wait. If these were payment events the answer would be
different — and the pattern would still be right, just with a durable queue behind
it instead of `setImmediate`.

Adding a new side-effect of a click — a webhook, a geo-IP lookup, a rate-limit
counter — is now one `subscribe()` call, and the redirect stays exactly as fast.

---

### 10 · Builder

```js
return ApiResponse.created()
  .message("Short URL created.")
  .data({ url })
  .send(res);
```

```js
toJSON() {
  const body = { success: this.#status < 400 };   // derived, not asserted
  if (this.#message !== null) body.message = this.#message;
  Object.assign(body, this.#meta);
  if (this.#data !== undefined) body.data = this.#data;
  return body;
}
```

**Why.** Every endpoint used to hand-assemble its own object, and they had **already
drifted**: some had a `count`, some nested `data.url`, some returned the array bare.
The frontend had a different unwrapping ritual for each one.

`success` is now *derived* from the status code rather than typed by hand — so it
cannot disagree with the HTTP response.

---

### 11 · Dependency Injection

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

Notice what `UrlService` **imports**: nothing. Not the repository, not the
validator, not the database. It cannot reach for a global even if it wanted to.

The wiring lives in exactly one place:

```js
// app/container.js — the composition root
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

**Why.** This is the pattern that makes the other eleven *usable*. A unit test for
`UrlService` hands it a fake repository — no Postgres, no Express, no network.
Swapping `InMemoryCache` for Redis is one line here, and nothing downstream notices.

The honest cost: *something* has to do the wiring, and it's this file. That's the
trade — one explicit, readable graph instead of `new` calls and module-level
singletons scattered across thirty files.

---

### 12 · Facade

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

**Why.** The three old service files each repeated the same twenty lines — build the
URL, set `Content-Type`, attach the bearer token, parse JSON, check `res.ok`, throw,
log, rethrow.

And they had **already drifted**: only two of the three sent the token at all, and
each invented its own fallback error message. That's the failure mode this pattern
exists to prevent — not verbosity, but *divergence*.

---

## MCP (Model Context Protocol)

MCP is how an AI assistant calls your code. The server exposes **tools**; the client
(Claude Desktop, or our own chat) decides which to call and when.

Trunc ships a full MCP server with **two transports** and **two clients**.

```mermaid
graph LR
    subgraph Clients["MCP Clients"]
        CD["Claude Desktop"]
        Chat["Trunc's own chat<br/>/api/chat"]
    end

    subgraph Server["MCP Server"]
        Stdio["stdio transport<br/>local subprocess"]
        Http["HTTP transport<br/>streamable, stateless"]
        Tools["tools.ts<br/>whoami · shorten_url<br/>get_my_links · get_clicks_by_day"]
    end

    API["Express API"]

    CD -->|"MIKKU_MCP_TOKEN"| Stdio
    CD -->|"Authorization: Bearer"| Http
    Chat -->|"Authorization: Bearer"| Http
    Stdio --> Tools
    Http --> Tools
    Tools -->|"SHORTENER_API_BASE"| API

    classDef c fill:#0d0d0d,stroke:#37f712,color:#fff
    classDef s fill:#111,stroke:#666,color:#fff
    class CD,Chat c
    class Stdio,Http,Tools,API s
```

### The tools

| Tool | Auth | What it does |
|:--|:--|:--|
| `whoami` | — | Whether a JWT is visible to the server. |
| `shorten_url` | **required** | Shorten a URL. Takes an optional `customAlias`. |
| `get_my_links` | **required** | List the signed-in user's links. |
| `get_clicks_by_day` | **required** | Clicks per day (1–90), zero-filled. |

### The auth model

**The MCP server has no login of its own.** It identifies the caller by the JWT the
web app issues, and it never mints one. That is deliberate:

- **HTTP transport** — the token arrives per-request in the `Authorization` header.
  The server is **stateless**: no sessions, no stored credentials. Two users hitting
  the same deployed server see only their own links.
- **stdio transport** — Claude Desktop runs the server as a subprocess, so there is
  no request to carry a header. The token comes from an env var in the client config.

Get your token from the in-app guide at **`/mcp`**, which shows it and generates a
ready-to-paste config.

### Connecting Claude Desktop

**HTTP** (nothing to install):

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "trunc": {
      "url": "https://trunc-mcp-server.onrender.com/mcp",
      "headers": { "Authorization": "Bearer <your-jwt>" }
    }
  }
}
```

**stdio** (runs locally):

```jsonc
{
  "mcpServers": {
    "trunc": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server/src/index.ts"],
      "env": {
        "SHORTENER_API_BASE": "http://localhost:5050",
        "TRUNC_MCP_TOKEN": "<your-jwt>"
      }
    }
  }
}
```

Quit Claude Desktop **completely** (⌘Q) and reopen it. Then just ask:

> *"shorten github.com/subhm2004 and tell me which of my links is doing best"*

Full docs: **[mcp-server/README.md](mcp-server/README.md)**.

---

## The AI assistant

The app ships its own chat at **`/chat`** — and it is a **genuine MCP client**, not a
chatbot bolted on beside one. It speaks the same protocol, to the same endpoint,
calling the same tools Claude Desktop would.

```mermaid
sequenceDiagram
    autonumber
    participant U as You
    participant R as /api/chat<br/>server-side only
    participant M as MCP Server
    participant G as Groq<br/>llama-3.3-70b
    participant A as Express API

    U->>R: "shorten github.com and show my top links"
    R->>M: tools/list
    M-->>R: 4 tool definitions
    R->>G: messages + tools
    G-->>R: tool_calls: [shorten_url, get_my_links]

    loop for each tool call (max 4 rounds)
        R->>M: tools/call
        M->>A: POST /api/shorten
        A-->>M: { url }
        M-->>R: result
    end

    R->>G: tool results
    G-->>R: final answer
    R-->>U: answer + the full tool trace
```

Two things make this more than a demo.

**The tool list is not hardcoded.** `/api/chat` asks the MCP server what tools exist
and hands that list to the model. Add a tool to `mcp-server/src/tools.ts` and it
appears in the chat with **no change to the frontend**.

**It shows its work.** The arguments, the raw result, and the latency of every tool
call are on screen, expandable. Most chat UIs bury this: you get an answer and no way
to tell whether the model looked anything up or simply made it up.

> An assistant you cannot check is an assistant you cannot trust.

```
you    shorten github.com/subhm2004 and show my top links

       ✓ shorten_url                                    142ms   [+]
       ✓ get_my_links                                    89ms   [+]

trunc  Done — it's at trunc.sh/x7Kp2mQ1. Your best performer is
       /neon-db with 51 clicks, about half of everything this month.
```

### Security

`GROQ_API_KEY` has **no `NEXT_PUBLIC_` prefix**, so Next refuses to inline it into
the client bundle. The chat runs entirely inside a route handler on the server — the
browser never sees the key, and never sees the MCP server's address either.
`lib/mcpClient.ts` imports `server-only`, so importing it into a client component is
a **build error** rather than a leak.

The loop is capped at four tool rounds. A model that keeps reaching for tools would
keep spending tokens forever; four is plenty for *"shorten this and show my stats"*
and it bounds the cost of a bad prompt.

---

## Authentication

Two ways in, one token out.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant A as Express API
    participant G as Google
    participant D as PostgreSQL

    rect rgb(20,20,20)
    Note over B,D: Password
    B->>A: POST /api/auth/login
    A->>D: SELECT … WHERE lower(email) = lower($1)
    D-->>A: user + password_hash
    A->>A: bcrypt.compare
    A-->>B: JWT
    end

    rect rgb(20,20,20)
    Note over B,D: Google OAuth 2.0 — authorization code
    B->>A: GET /api/auth/google
    A->>A: sign state nonce → httpOnly cookie
    A-->>B: 302 → Google consent
    B->>G: consent
    G-->>B: 302 → /api/auth/google/callback?code&state
    B->>A: callback
    A->>A: verify state (CSRF)
    A->>G: exchange code (client_secret)
    G-->>A: id_token
    A->>A: check aud · iss · exp · email_verified
    A->>D: find by google_id → else link by email → else create
    A-->>B: 302 → /auth/callback#token=JWT
    end
```

Google is simply **another way to obtain our JWT**. Everything downstream — the
dashboard, MCP, every protected route — is unchanged. One token system.

Three decisions worth reading:

**Account linking happens only on a Google-verified email.** If you signed up with a
password and later click *Continue with Google* on the same address, the two are
linked and your password keeps working. That is safe **only** because a profile whose
email Google hasn't verified is refused outright. Without that check, this branch is
an account-takeover primitive: register a Google account claiming someone else's
address, and walk into their account.

**The `state` nonce is the CSRF defence**, and the attack it stops runs backwards
from the usual one. Without it an attacker completes their own consent and tricks
*your* browser into our callback with *their* code — silently signing you into the
attacker's account, where everything you then shorten lands in their dashboard. It's
forgotten precisely because the damage flows the other way.

**The JWT comes back in the URL fragment**, not the query string. A fragment is never
sent to any server — not ours, not in a `Referer` header, not into access or proxy
logs. The callback page strips it with `history.replaceState` the moment it has read
it. (A cookie would be tidier, but the token must be readable by JS: the `/mcp` page
shows it to you so you can paste it into a client config.)

The whole feature is **optional**. With no client id configured the routes aren't
mounted and the frontend hides the button — because it *asks* (`GET /api/auth/providers`)
rather than assuming.

---

## What the rewrite fixed

Trunc started as a Mongoose app. These were real defects in it, each now fixed and
**verified against a live Postgres in CI** — not asserted in a README.

**`url_code` had no unique constraint.**
It is the redirect key. Two links could be handed the same generated code, and one of
them would send visitors to the wrong site. It's now `UNIQUE`, and the service retries
on collision rather than pre-checking — pre-checking races.

**Click counting lost increments under load.**
The redirect did read → `clickCount++` → `save()`. Two concurrent clicks both read the
same value; one increment vanished. It's now one atomic statement:

```sql
UPDATE urls SET click_count = click_count + 1 WHERE id = $1
```

> **Verified: 50 concurrent requests → exactly 51 counted.**

**Analytics didn't scale.**
`clicks-by-day` loaded every URL row — each carrying its full array of click timestamps
— into Node, then counted them in a JS `Map`. That's O(every click ever) work and memory
per dashboard load. It's now one SQL aggregation over a `generate_series` date spine,
which zero-fills quiet days for free.

**The URL validator accepted dangerous input.**
See [Chain of Responsibility](#08--chain-of-responsibility) — `javascript:` URLs and the
cloud metadata endpoint both sailed through.

**Auth was documented but not enforced.**
The old middleware called `next()` when no token was present, so `/api/shorten` was wide
open despite the docs, and every protected controller re-checked `if (!req.user)` by hand.
There are now two explicit middlewares, `requireAuth` and `optionalAuth`.

**Custom aliases could be claimed anonymously.**
A generated code is drawn from a space nobody wants. An alias is a claim on a scarce,
*global* namespace — there is exactly one `/google`, one `/paypal`, one `/launch`. Handing
those to anonymous callers is handing out a squatting tool, and there is nobody to take
them back from. Aliases now require an account.

**The redirect was a 301.**
A 301 is cached by the browser *forever*, so every click after the first never reaches the
server. The count would freeze at 1, and the link could never be repointed. It's a 302.

---

## API reference

| Method | Endpoint | Auth | Description |
|:--|:--|:--|:--|
| `GET` | `/health` | — | Health check. |
| `POST` | `/api/auth/register` | — | Register. Returns a JWT so the client auto-logs in. |
| `POST` | `/api/auth/login` | — | Log in. Returns a JWT. |
| `GET` | `/api/auth/me` | **required** | The signed-in user. The JWT carries only an id. |
| `GET` | `/api/auth/providers` | — | Which sign-in methods are configured. |
| `GET` | `/api/auth/google` | — | Start the OAuth flow. *(only if configured)* |
| `GET` | `/api/auth/google/callback` | — | OAuth return. *(only if configured)* |
| `POST` | `/api/shorten` | optional | Shorten a URL. `customAlias` **requires** an account. |
| `GET` | `/:code` | — | Redirect (302) and record the click. |
| `GET` | `/api/links/my-links` | **required** | Your links. |
| `GET` | `/api/links/clicks-by-day?days=30` | **required** | Clicks per day (1–90). Zero-filled. |
| `GET` | `/api/links/overview` | **required** | Totals + your top 5 links. |

Every response uses the same envelope:

```jsonc
{ "success": true, "message": "Short URL created.", "data": { "url": { … } } }
```

4xx errors echo a clean message. 5xx errors return a generic one and **never leak
internals** — connection strings, table names and hostnames all live in 5xx messages.

---

## Testing and CI

Three jobs, on every push and pull request.

```mermaid
graph LR
    Push["git push"] --> CI{"GitHub Actions"}
    CI --> B["backend<br/>smoke test on a real Postgres"]
    CI --> M["mcp-server<br/>typecheck · 28 tests · build"]
    CI --> F["frontend<br/>lint · build"]

    B --> PG[("postgres:17<br/>service container")]

    classDef j fill:#111,stroke:#37f712,color:#fff
    class B,M,F j
```

The backend has **no unit tests**. It has something better for this shape of code: a
smoke test that drives the real server, on a real Postgres, over HTTP — **37 checks**,
each one corresponding to a bug that actually shipped.

Several of them cannot be caught any other way:

- the **click race** only appears under genuine concurrency
- the **unique constraint** on `url_code` only exists in the database
- the **SSRF/XSS rules** only matter against the real validation chain
- the **401s** only happen if the real middleware is mounted on the real routes

```bash
cd app
npm run smoke      # against a running server
```

> The concurrency check **polls for convergence** rather than sleeping. Clicks are
> written *after* the response — that is the whole point of the Observer seam, and it
> makes the count eventually consistent. A fixed sleep raced the writes and would have
> failed in CI at random. **A flaky check is worse than no check**: people learn to
> re-run it. And this is *the* check guarding the lost-increment fix.

---

## Deployment

Four services, three providers, all on free tiers.

| Service | Where | Why there |
|:--|:--|:--|
| **Database** | [Neon](https://neon.tech) | Serverless Postgres. |
| **Backend** — `app/` | [Render](https://render.com) | Needs a long-running process: it serves the redirects. |
| **MCP server** — `mcp-server/` | [Render](https://render.com) | Same — a long-running HTTP service. |
| **Frontend** — `frontend/` | [Vercel](https://vercel.com) | It's a Next.js app. |

### Read this first

**1 · Short links live on the backend domain.**
The `/:code` redirect is an Express route on Render. `https://trunc-app-api.onrender.com/aB12xY9z`
works; `https://trunc.vercel.app/aB12xY9z` gives Next's 404. `BASE_URL` must point at Render.

**2 · Render's free tier sleeps.**
~15 minutes idle → spin-down → the next request takes **~50 seconds**. Annoying for a
dashboard; *fatal* for a shortener. Pay ($7/mo), ping `/health` on a cron, or accept it for
a portfolio project.

**3 · `NEXT_PUBLIC_` is a security decision, not a naming convention.**
Next inlines any `NEXT_PUBLIC_*` variable into the browser bundle. **Prefix `GROQ_API_KEY`
and your key is public the moment you deploy.**

**4 · Those variables are baked in at build time.** Change one and you must **redeploy**.

**5 · Backend and frontend each need the other's URL.** So the order is
**backend → MCP → frontend → back to the backend.**

### Step 1 — Backend on Render

**New → Web Service** → this repo.

| Field | Value |
|:--|:--|
| **Root Directory** | `app` ← easy to miss, nothing works without it |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

| Environment variable | Value |
|:--|:--|
| `DATABASE_URL` | your Neon **pooled** string (host contains `-pooler`) |
| `JWT_SECRET` | a **fresh** one — never reuse your local one |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://trunc-app-api.onrender.com` ← its own URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000` ← temporary; fixed in Step 4 |
| `FRONTEND_URL` | `http://localhost:3000` ← temporary; fixed in Step 4 |

> **Don't set `PORT`** — Render injects it.
> Migrations run at boot; there is no separate step.

### Step 2 — MCP server on Render

| Field | Value |
|:--|:--|
| **Root Directory** | `mcp-server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:http` |

| Environment variable | Value |
|:--|:--|
| `SHORTENER_API_BASE` | `https://trunc-app-api.onrender.com` |
| `NODE_ENV` | `production` |

**No `TRUNC_MCP_TOKEN`** — the HTTP transport reads each user's token per request.

### Step 3 — Frontend on Vercel

**Root Directory:** `frontend`. Framework autodetects as Next.js.

| Environment variable | Value | Prefix? |
|:--|:--|:--|
| `NEXT_PUBLIC_API_URL` | `https://trunc-app-api.onrender.com` | ✅ |
| `NEXT_PUBLIC_MCP_URL` | `https://trunc-mcp-server.onrender.com/mcp` | ✅ |
| `MCP_SERVER_URL` | `https://trunc-mcp-server.onrender.com/mcp` | ❌ |
| `GROQ_API_KEY` | from [console.groq.com/keys](https://console.groq.com/keys) | ❌ **never** |

### Step 4 — Close the loop

Back on Render → backend → Environment:

```
ALLOWED_ORIGINS = https://your-app.vercel.app
FRONTEND_URL    = https://your-app.vercel.app
```

`FRONTEND_URL` is where the Google flow sends the browser home. Leave it on localhost and
a production sign-in redirects your users to *their own machine*.

### Step 5 — Google sign-in (optional)

**Google Cloud Console → Credentials → OAuth client (Web application)**

| Field | Value |
|:--|:--|
| Authorized **JavaScript origins** | *leave empty* — this is a server-side flow |
| Authorized **redirect URIs** | `https://trunc-app-api.onrender.com/api/auth/google/callback` |

Keep the `http://localhost:5050/...` entry alongside it for local dev. It must match
**byte for byte** — a trailing slash or `http` vs `https` fails with only
`redirect_uri_mismatch` to go on.

**OAuth consent screen → Test users → + ADD USERS.** While the app is in *Testing*, only
listed accounts can sign in. Miss this and you get `Access blocked: … has not completed the
Google verification process`, which says nothing about the cause.

Then on Render → backend:

```
GOOGLE_CLIENT_ID     = …apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-…
GOOGLE_REDIRECT_URI  = https://trunc-app-api.onrender.com/api/auth/google/callback
```

### Which URL goes where

| Service | Variable | → points at |
|:--|:--|:--|
| Backend | `DATABASE_URL` | Neon |
| Backend | `BASE_URL` | **itself** — short links are minted against it |
| Backend | `ALLOWED_ORIGINS` | Vercel |
| Backend | `FRONTEND_URL` | Vercel — where OAuth returns to |
| Backend | `GOOGLE_REDIRECT_URI` | **itself** — where Google returns to |
| MCP | `SHORTENER_API_BASE` | Backend |
| Frontend | `NEXT_PUBLIC_API_URL` | Backend |
| Frontend | `NEXT_PUBLIC_MCP_URL` | MCP — displayed on `/mcp` |
| Frontend | `MCP_SERVER_URL` | MCP — used by `/api/chat`, server-side |

### Troubleshooting

| Symptom | Cause |
|:--|:--|
| CORS errors on every call | `ALLOWED_ORIGINS` doesn't exactly match the Vercel origin (no trailing slash) |
| API calls 404 on the Vercel domain | `NEXT_PUBLIC_API_URL` wasn't set **at build time** — set it and **redeploy** |
| A short link shows the app's 404 | You used the *Vercel* domain. Short links live on the backend — check `BASE_URL` |
| Google returns to `localhost:3000` | `FRONTEND_URL` is still on localhost |
| `redirect_uri_mismatch` | Console URI ≠ `GOOGLE_REDIRECT_URI`. The backend logs the one it sent |
| `Access blocked: … verification process` | Your account isn't in the consent screen's **Test users** |
| "Chat isn't configured" | `GROQ_API_KEY` missing on Vercel — and check it has **no** `NEXT_PUBLIC_` |
| First chat message times out | Free-tier cold start on the MCP server (~50s). The route allows 60s |
| Everyone logged out after a deploy | You changed `JWT_SECRET`. Set it once, never touch it |

---

## Configuration

### `app/.env`

| Variable | Default | Purpose |
|:--|:--|:--|
| `DATABASE_URL` | — | **Required.** TLS turns on automatically for non-local hosts. |
| `JWT_SECRET` | — | **Required.** Changing it invalidates every existing session. |
| `PORT` | `5050` | Not 5000 — see the macOS note in [Quick start](#quick-start). |
| `BASE_URL` | `http://localhost:5050` | Origin short links are minted against. **Derived, not stored** — moving domains doesn't break existing links. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins, comma-separated. |
| `FRONTEND_URL` | `http://localhost:3000` | Where the OAuth flow returns to. |
| `SHORT_CODE_STRATEGY` | `nanoid` | `nanoid` \| `base62` — see [Strategy](#06--strategy). |
| `CACHE_ENABLED` | `true` | `false` injects the [`NullCache`](#05--null-object). |
| `GOOGLE_CLIENT_ID` | — | Optional. Unset ⇒ the whole feature switches off cleanly. |
| `GOOGLE_CLIENT_SECRET` | — | Optional. |
| `GOOGLE_REDIRECT_URI` | derived from `BASE_URL` | Must match Google's console **byte for byte**. |

### `frontend/.env.local`

| Variable | Dev | Production (Vercel) |
|:--|:--|:--|
| `NEXT_PUBLIC_API_URL` | **unset** — the browser uses a relative `/api/…` path, same origin, and Next proxies it. No CORS. | The Render URL. Vercel and Render are genuinely different origins, so the browser must call it directly. |
| `BACKEND_ORIGIN` | `http://localhost:5050` — where Next forwards `/api`. | Unused. |
| `NEXT_PUBLIC_MCP_URL` | `http://localhost:3001/mcp` | The Render MCP URL. |
| `MCP_SERVER_URL` | `http://localhost:3001/mcp` | The Render MCP URL. **Server-only.** |
| `GROQ_API_KEY` | your key | your key. **Never** prefixed. |

---

## Project layout

```
app/                        Backend — Express + PostgreSQL
├─ config/                  Env parsing + boot-time validation      → Singleton
├─ core/
│  ├─ errors.js             AppError hierarchy
│  ├─ logger.js             Level-filtered, redacts secrets         → Singleton
│  ├─ ApiResponse.js        One response envelope                   → Builder
│  └─ EventBus.js           Publish/subscribe                       → Observer
├─ db/
│  ├─ pool.js               Connection pool                         → Singleton
│  ├─ migrate.js            Migration runner (advisory-locked)
│  └─ migrations/           Plain SQL, applied in order
├─ cache/
│  ├─ InMemoryCache.js      TTL + LRU
│  └─ NullCache.js                                                  → Null Object
├─ repositories/
│  ├─ BaseRepository.js     Query + transaction plumbing            → Template Method
│  ├─ UserRepository.js                                             → Repository
│  ├─ UrlRepository.js                                              → Repository
│  ├─ ClickRepository.js                                            → Repository
│  └─ CachedUrlRepository.js                                        → Decorator
├─ strategies/shortcode/    NanoId · Base62 · CustomAlias           → Strategy + Factory
├─ validation/              The URL rule chain                      → Chain of Responsibility
├─ services/                Auth · Google · Url · Analytics
├─ observers/               Post-response side-effects
├─ controllers/             Transport only
├─ routes/                  HTTP surface
├─ scripts/smoke.mjs        37 end-to-end checks
├─ server.js                App factory
└─ container.js             Composition root                        → Dependency Injection

frontend/                   Next.js 15 · TypeScript · Tailwind v4
└─ src/
   ├─ app/
   │  ├─ page.tsx           Landing — the live pipeline
   │  ├─ chat/              The MCP-client assistant
   │  ├─ api/chat/          Groq + tool loop — server-only
   │  ├─ dashboard/         Links, clicks, analytics
   │  ├─ mcp/               Token + client configs
   │  └─ auth/callback/     OAuth return
   ├─ components/
   │  ├─ Pipeline.tsx       The terminal — layers print as they run
   │  ├─ ScrambleText.tsx   The short code decrypting into place
   │  └─ Shortener.tsx      Form → pipeline → code → link
   ├─ context/              AuthProvider
   └─ lib/
      ├─ api.ts             One typed entry point to the API        → Facade
      ├─ mcpClient.ts       JSON-RPC to the MCP server (server-only)
      └─ tokenStore.ts      The only module that knows where the JWT lives

mcp-server/                 TypeScript — stdio + HTTP transports
└─ src/tools.ts             The four tools
```

---

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
<br />
<sub>Built by <a href="https://github.com/subhm2004">Shubham Malik</a></sub>
</div>
