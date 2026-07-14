<div align="center">

# Trunc

**Cut it short.**

A URL shortener with click analytics, a private dashboard, and an MCP server —
so your AI assistant can shorten links and read your stats from a conversation.

`Postgres` · `Express` · `React` · `MCP`

[![License: MIT](https://img.shields.io/badge/License-MIT-111111.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-111111.svg?style=flat-square)](https://nodejs.org)
[![Postgres](https://img.shields.io/badge/postgres-14%2B-111111.svg?style=flat-square)](https://postgresql.org)

</div>

---

Most shorteners hide the machinery. Trunc shows it to you: paste a URL on the
landing page and every layer the request passes through lights up, in order, as
the real request runs.

```
$ POST /api/shorten                                        42ms round-trip
  ✓ UrlValidator.validate()          CHAIN OF RESPONSIBILITY
  ✓ ShortCodeStrategy.generate()     STRATEGY + FACTORY
  ✓ UrlRepository.create()           REPOSITORY + DECORATOR
  ✓ EventBus.publish(link.created)   OBSERVER              async
  → url_code = "Yw3dcSQK"
```

That isn't decoration. It's the actual architecture, and this README explains
every piece of it.

---

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Design patterns](#design-patterns)
- [What the rewrite fixed](#what-the-rewrite-fixed)
- [API](#api)
- [MCP server](#mcp-server)
- [Configuration](#configuration)
- [Deployment](DEPLOYMENT.md) — Render + Vercel + Neon, step by step

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
cd ui
npm install
npm run dev            # → http://localhost:5173
```

Open **http://localhost:5173** and shorten something.

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
its constructor and imports none of them — which is what makes them testable
without a database, and what lets the cache be swapped for Redis by editing one
line.

```
routes/          HTTP surface. Auth middleware, nothing else.
    ↓
controllers/     Transport only. Read the request, call a service, shape the response.
    ↓
services/        The business logic. Knows nothing about HTTP or SQL.
    ↓
repositories/    All the SQL. Nothing above this layer imports a database driver.
    ↓
db/              Connection pool + migrations.

core/            Errors · logger · response builder · event bus
strategies/      Short-code generation (swappable at runtime)
validation/      The URL rule chain
observers/       Side-effects of a click — run after the response is sent
container.js     The composition root: the one file that wires it all together
```

### The three tables

```sql
users   (id, name, email, password_hash, …)
urls    (id, url_code UNIQUE, long_url, user_id, click_count, …)
clicks  (id, url_id, clicked_at, referer, user_agent)
```

Clicks live in their own table, not in an array on the URL row. An array grows the
row on every single click, eventually hits Postgres' tuple limits, and can't be
aggregated in SQL without unnesting it first.

---

## Design patterns

Twelve of them. None are here to pad a list — each one is here because something
was hard to change, unsafe, or slow without it. That's what the last column is for.

| # | Pattern | Where | Why it earns its place |
|:--|:--|:--|:--|
| 01 | **Singleton** | `config/` · `db/pool.js` · `core/logger.js` | One Postgres pool per process. A pool per request would exhaust the connection limit. |
| 02 | **Repository** | `repositories/User·Url·Click` | SQL sits behind an interface, so no service ever imports `pg`. |
| 03 | **Template Method** | `BaseRepository` | Subclasses declare the table and row mapping; they inherit the query and transaction plumbing. |
| 04 | **Decorator** | `CachedUrlRepository` | Adds caching to the redirect lookup. Same interface, so no service knows it exists. |
| 05 | **Null Object** | `NullCache` | Disabling the cache is an injection, not a codebase littered with `if (cache)`. |
| 06 | **Strategy** | `strategies/shortcode/` | `SHORT_CODE_STRATEGY=base62` changes how every code is minted. Not one line of `UrlService` moves. |
| 07 | **Factory** | `ShortCodeStrategyFactory` | The only place that knows the concrete strategy classes by name. |
| 08 | **Chain of Responsibility** | `validation/` | Each URL rule rejects or passes along. Rule order is configuration, not nested `if`s. |
| 09 | **Observer** | `core/EventBus` | The redirect responds immediately; the click is recorded on the next tick. |
| 10 | **Builder** | `core/ApiResponse` | One response envelope, decided once, instead of five that had drifted apart. |
| 11 | **Dependency Injection** | `container.js` | Everything takes its collaborators in. That's what makes it unit-testable. |
| 12 | **Facade** | `ui/src/services/HttpClient` | Three UI service files repeated the same fetch/error dance. Now they don't. |

### Seeing a seam work

Swap the code generator without touching a single service:

```bash
# app/.env
SHORT_CODE_STRATEGY=base62     # nanoid | base62
```

Custom aliases work with either strategy:

```bash
curl -X POST localhost:5050/api/shorten \
  -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"longUrl": "https://example.com", "customAlias": "launch"}'
```

---

## What the rewrite fixed

Trunc started as a Mongoose app. These were real defects in it — each one now
fixed and verified against a live Postgres.

**`url_code` had no unique constraint.**
It's the redirect key. Two links could be handed the same generated code, and one
of them would send visitors to the wrong site. It is now `UNIQUE`, and the service
retries on collision rather than pre-checking — pre-checking races.

**Click counting lost increments under load.**
The redirect did read → `clickCount++` → `save()`. Two concurrent clicks both read
the same value; one increment vanished. It is now a single atomic
`UPDATE … SET click_count = click_count + 1`.
*Verified: 50 concurrent requests → exactly 51 counted.*

**Analytics didn't scale.**
`clicks-by-day` loaded every URL row — each carrying its full array of click
timestamps — into Node, then counted them in a JS `Map`. That's O(every click ever)
work and memory on each dashboard load. It's now one SQL aggregation over a
`generate_series` date spine, which also zero-fills empty days for free.

**The URL validator accepted dangerous input.**
`valid-url`'s `isUri()` happily accepted `javascript:alert(1)` — stored XSS in any
client that renders the link — and `http://169.254.169.254/`, the cloud metadata
endpoint, turning the shortener into an SSRF gadget wearing your domain. The rule
chain now enforces a protocol allowlist and blocks private hosts.

**Auth was documented but not enforced.**
The old middleware called `next()` when no token was present, so `/api/shorten` was
wide open despite the docs saying otherwise, and every protected controller
re-checked `if (!req.user)` by hand. There are now two explicit middlewares:
`requireAuth` and `optionalAuth`.

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
internals.

> The redirect is a **302, not a 301**. A 301 is cached by the browser forever, so
> every click after the first would never reach the server — the count would freeze
> at 1, and the link could never be repointed.

---

## MCP server

Lets Claude Desktop (or any MCP client) drive the shortener. Two transports —
stdio and HTTP — sharing one tool surface. Every tool requires a JWT, issued by the
web app.

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
| `PORT` | `5050` | See the macOS note above. |
| `BASE_URL` | `http://localhost:5050` | Origin short links are minted against. Short URLs are **derived** from this, not stored — so moving domains doesn't break existing links. |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS origins, comma-separated. |
| `SHORT_CODE_STRATEGY` | `nanoid` | `nanoid` \| `base62` |
| `SHORT_CODE_LENGTH` | `8` | |
| `CACHE_ENABLED` | `true` | The redirect-path cache. `false` injects the `NullCache`. |
| `LOG_LEVEL` | `debug` (dev) | `error` \| `warn` \| `info` \| `debug` |

---

## Project layout

```
app/            Backend — Express + Postgres
  ├─ config/         Env parsing + validation (Singleton)
  ├─ core/           Errors · logger · ApiResponse · EventBus
  ├─ db/             Pool + SQL migrations
  ├─ repositories/   All SQL lives here
  ├─ services/       Business logic
  ├─ controllers/    Transport only
  ├─ strategies/     Short-code generation
  ├─ validation/     The URL rule chain
  ├─ observers/      Post-response side-effects
  └─ container.js    Composition root

ui/             Frontend — React + Vite + Tailwind v4
  └─ src/
     ├─ pages/       LandingPage · Dashboard · Login · Register · McpGuide
     ├─ components/  Pipeline (the landing-page animation) · charts · nav
     └─ services/    HttpClient facade + thin API modules

mcp-server/     MCP server — TypeScript, stdio + HTTP transports
```

---

## License

MIT.
