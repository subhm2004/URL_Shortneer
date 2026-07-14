#!/usr/bin/env bash
#
# make_commits.sh — build the repository's history as a sequence of atomic,
# reviewable commits instead of one opaque "first commit" containing 101 files.
#
# The commits are ordered the way the system is actually layered: config, then
# the database, then the primitives everything else sits on, then repositories,
# then the domain, then HTTP, then the UI. A reviewer can read `git log` top to
# bottom and follow how the thing was built.
#
# Timestamps are real — these commits are made when you run this. The script does
# not backdate anything, and you should not make it: a fabricated author date is
# trivially caught (GitHub shows author date and commit date separately) and it
# would turn honest work into something you'd have to defend.
#
# Usage:
#   ./make_commits.sh              # commit into the current repo
#   ./make_commits.sh --dry-run    # print the plan, touch nothing
#
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# Safety rails
# ---------------------------------------------------------------------------

if [[ ! -d .git ]]; then
  echo "→ git init"
  $DRY_RUN || { git init -q; git branch -M main; }
fi

if ! $DRY_RUN && [[ -n "$(git log --oneline -1 2>/dev/null || true)" ]]; then
  echo "This repo already has commits. Refusing to run — rewriting an existing"
  echo "history is not something a script should do behind your back."
  exit 1
fi

# A .env holding a live database password must never reach a remote. The
# .gitignore covers it, but a typo in .gitignore would be a very bad day, so we
# check rather than assume.
for env_file in .env app/.env ui/.env mcp-server/.env; do
  if [[ -f "$env_file" ]] && ! git check-ignore -q "$env_file"; then
    echo "REFUSING TO RUN: $env_file exists and is NOT gitignored."
    echo "It would be committed. Fix .gitignore first."
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# The history. One entry per commit: "message" followed by the paths it covers.
# ---------------------------------------------------------------------------

commit() {
  local message="$1"; shift

  if $DRY_RUN; then
    printf '%3d. %s\n' "$((++COUNT))" "$message"
    return
  fi

  # Only commit paths that exist and actually have something to stage —
  # otherwise a renamed file would abort the whole run.
  local staged=false
  for path in "$@"; do
    if [[ -e "$path" ]]; then
      git add -- "$path"
      staged=true
    fi
  done

  if ! $staged || git diff --cached --quiet; then
    echo "  (skipped, nothing to stage) $message"
    return
  fi

  git commit -q -m "$message"
  printf '%3d. %s\n' "$((++COUNT))" "$message"
}

COUNT=0

# ---- foundations ----------------------------------------------------------
commit "chore: add gitignore

Excludes .env everywhere. The backend's .env holds a live Postgres password;
it must never reach a remote." \
  .gitignore

commit "chore(app): scaffold the Express backend package" \
  app/package.json

commit "chore(ui): scaffold the React + Vite frontend" \
  ui/package.json ui/package-lock.json ui/index.html ui/src/main.jsx \
  ui/eslint.config.js ui/public

commit "chore(mcp): scaffold the MCP server package" \
  mcp-server/package.json mcp-server/package-lock.json \
  mcp-server/tsconfig.json mcp-server/vitest.config.ts

# ---- configuration --------------------------------------------------------
commit "feat(config): read and validate the environment once, at boot

A missing DATABASE_URL now fails on startup rather than on the first request
that happens to need it. Every module consumes this frozen object instead of
reaching into process.env." \
  app/config/index.js

commit "feat(config): enable TLS automatically for hosted Postgres

Neon, Supabase and Railway terminate TLS with a cert that isn't in Node's trust
store. A local Postgres speaks no TLS at all. Deciding this from the connection
string means one .env works for both." \
  app/.env.example

# ---- database -------------------------------------------------------------
commit "feat(db): add the Postgres connection pool as a singleton

One pool per process. A pool per request would open a new TCP connection each
time and exhaust the server's connection limit." \
  app/db/pool.js

commit "feat(db): add a migration runner with advisory locking

Two instances booting at once (a rolling deploy, docker scale) would otherwise
both try to apply the same migration. Each migration runs in its own
transaction, so a failure leaves the schema untouched rather than half-applied." \
  app/db/migrate.js

commit "feat(db): initial schema — users, urls, clicks

Three deliberate choices, each fixing something the previous schema got wrong:

- urls.url_code is UNIQUE. It is the redirect key; without the constraint two
  links could be handed the same code and one would send visitors to the wrong
  site.
- Partial unique indexes on (long_url, user_id). Postgres treats NULLs as
  distinct, so a plain composite index would let anonymous users create
  unlimited duplicates of the same URL.
- Clicks are their own table, not an array on the url row. An array grows the
  row on every click, eventually hits Postgres' tuple limits, and cannot be
  aggregated in SQL without unnesting it first." \
  app/db/migrations/001_init.sql

# ---- core primitives ------------------------------------------------------
commit "feat(core): add an AppError hierarchy

One error shape for every layer, so a single handler can map it to a status
code. isOperational separates errors we expected from bugs we didn't." \
  app/core/errors.js

commit "feat(core): add a level-filtered logger that redacts secrets

Replaces console.log calls that were printing user emails and full JWTs to
stdout. Values under password/token/secret keys are never printed, however
deeply nested." \
  app/core/logger.js

commit "feat(core): add an ApiResponse builder

Every endpoint was hand-assembling its own envelope and they had drifted — some
had a count, some nested data.url, some had neither. The envelope is now one
decision made in one place." \
  app/core/ApiResponse.js

commit "feat(core): add an event bus

Publishers don't know who is listening. This is what lets a redirect respond
immediately while the click is persisted afterwards. Subscribers can't take down
a redirect: emit swallows and logs their failures." \
  app/core/EventBus.js

# ---- cache ----------------------------------------------------------------
commit "feat(cache): add an in-memory TTL + LRU cache

Deliberately dependency-free. The point is the interface: swapping in Redis
later means one new class with the same three methods." \
  app/cache/InMemoryCache.js

commit "feat(cache): add a NullCache

A cache that never caches. Disabling caching is now an injection rather than a
codebase littered with 'if (cache)' guards — which is where cache bugs come
from." \
  app/cache/NullCache.js

# ---- repositories ---------------------------------------------------------
commit "feat(repo): add BaseRepository

Subclasses declare their table and row mapping and inherit the query and
transaction plumbing. No repository imports pg directly." \
  app/repositories/BaseRepository.js

commit "feat(repo): add UserRepository

password_hash is absent from the default projection — it is only ever selected
by the login path, so it cannot leak into an API response by accident." \
  app/repositories/UserRepository.js

commit "feat(repo): add UrlRepository

shortUrl is derived from BASE_URL, not stored. The old schema persisted the full
short URL on every row, so moving the app to a new domain silently broke every
link ever created.

Two fixes ride along:
- findByLongUrlAndUser uses IS NOT DISTINCT FROM. 'user_id = NULL' never matches
  in SQL, so anonymous lookups always missed and minted a fresh code every time.
- incrementClickCount is a single atomic UPDATE. The old read-modify-write meant
  two concurrent clicks read the same value and one increment was lost." \
  app/repositories/UrlRepository.js

commit "perf(repo): add ClickRepository, aggregating clicks-by-day in SQL

The previous implementation loaded every URL row — each carrying its full array
of click timestamps — into Node and counted them in a JS Map. That is O(every
click ever) work and memory on each dashboard load.

It is now one aggregation over a generate_series date spine, which also
zero-fills empty days for free." \
  app/repositories/ClickRepository.js

commit "feat(repo): add a caching decorator over UrlRepository

Caches findByCode, the one lookup every redirect performs. It implements the
same interface as the thing it wraps, so no service knows it exists.

Deliberately does not cache findByLongUrlAndUser: that runs on the write path,
where a stale answer would mean minting a duplicate row." \
  app/repositories/CachedUrlRepository.js

# ---- short-code strategies ------------------------------------------------
commit "feat(shortcode): define the ShortCodeStrategy interface

Code generation was a hardcoded nanoid(8) sitting in the middle of a controller.
Behind an interface it becomes a runtime choice." \
  app/strategies/shortcode/ShortCodeStrategy.js

commit "feat(shortcode): add NanoIdStrategy

Random, unguessable codes — you cannot enumerate other people's links by
counting up from your own. The alphabet drops 0/O and 1/l/I so a code survives
being read aloud." \
  app/strategies/shortcode/NanoIdStrategy.js

commit "feat(shortcode): add Base62Strategy

Functionally close to nanoid. It exists to prove the seam is real: setting
SHORT_CODE_STRATEGY=base62 changes how every code is minted and not one line of
UrlService moves." \
  app/strategies/shortcode/Base62Strategy.js

commit "feat(shortcode): add CustomAliasStrategy with reserved words

Lets a signed-in user pick their own slug. Reserved words are refused: a link at
/api or /login would be unreachable, because the router matches those first.

Unlike the random strategies this one can fail — the alias is user input, so it
is validated rather than generated. That asymmetry is exactly why generation is
an interface." \
  app/strategies/shortcode/CustomAliasStrategy.js

commit "feat(shortcode): add the strategy factory

The only place that knows the concrete strategy classes by name. Adding a fourth
algorithm is one case here." \
  app/strategies/shortcode/ShortCodeStrategyFactory.js

# ---- validation -----------------------------------------------------------
commit "feat(validation): add the rule-chain base

Each rule inspects the candidate and either passes it along or rejects it. Rules
don't know what follows them, so the order and membership of the chain are
configuration rather than nested ifs." \
  app/validation/ValidationRule.js

commit "fix(security): reject javascript:, data:, and private hosts

The previous validator was a single valid-url isUri() call, which accepts things
we must not shorten:

- javascript:alert(1) — stored XSS in any client that renders the link
- http://169.254.169.254/ — the cloud metadata endpoint, an SSRF gadget wearing
  our domain
- http://localhost:5050/admin — anything on our own private network

Protocol is now an allowlist (a blocklist is the wrong shape for this), and
private, loopback and link-local hosts are refused. Self-referential short links
are refused too — two of them chained is a redirect loop." \
  app/validation/rules/urlRules.js

commit "feat(validation): assemble the URL validator

Order is asserted here rather than left implicit: nothing can inspect the parsed
URL until ParsableRule has run." \
  app/validation/UrlValidator.js

# ---- services -------------------------------------------------------------
commit "feat(services): add AuthService

Login returns one identical error for 'no such user' and 'wrong password'.
Telling them apart lets an attacker enumerate which emails have accounts." \
  app/services/AuthService.js

commit "feat(services): add UrlService with collision retry

Random codes collide — rarely, but a finite space has birthday collisions once
you have millions of links, and the unique index will reject them. Rather than
pre-checking (which races), Postgres arbitrates and we retry.

Shortening is idempotent per user: pasting the same URL twice returns the same
link rather than a second one." \
  app/services/UrlService.js

commit "feat(services): add AnalyticsService

Clamps a bad ?days= rather than rejecting it. A malformed query string shouldn't
400 someone's dashboard." \
  app/services/AnalyticsService.js

# ---- observers ------------------------------------------------------------
commit "perf(observers): record clicks after the response is sent

Everything here runs once the visitor has already been redirected. The old code
awaited a database write before sending the redirect, so every visitor paid for
our analytics.

The trade-off is explicit: a click can be lost if the process dies in the ~1ms
between emit and write. For click counts that is a fair price for a faster
redirect." \
  app/observers/clickObservers.js

# ---- middleware -----------------------------------------------------------
commit "feat(middleware): add asyncHandler

Keeps controllers free of try/catch — which is what let the old code drift into
three different error-handling styles." \
  app/middleware/asyncHandler.js

commit "fix(auth): split requireAuth from optionalAuth

The old middleware called next() when no token was present. So /api/shorten was
wide open despite the docs saying it required auth, and every protected
controller re-checked 'if (!req.user)' by hand.

A malformed token is still a 401 — sending a broken token is a client bug worth
reporting, which is not the same thing as sending none." \
  app/middleware/authenticate.js

commit "fix(errors): one error handler, and never leak internals on 5xx

5xx messages can carry connection strings, table names, internal hostnames. Only
4xx messages — which we wrote ourselves — are echoed to the client." \
  app/middleware/errorHandler.js

# ---- controllers ----------------------------------------------------------
commit "refactor(controllers): make AuthController transport-only

No validation, no bcrypt, no SQL, no try/catch. Read the request, call a
service, shape the response." \
  app/controllers/AuthController.js

commit "fix(redirect): return 302, not 301

A 301 is cached by the browser forever, so every click after the first would
never reach the server. The count would freeze at 1 and the link could never be
repointed." \
  app/controllers/UrlController.js

commit "refactor(controllers): make LinkController transport-only

requireAuth guarantees req.user, so the inline 401 checks that used to open
every one of these methods are gone." \
  app/controllers/LinkController.js

# ---- wiring ---------------------------------------------------------------
commit "feat(routes): wire the HTTP surface

Routes are a function of the controllers rather than a module that imports them,
so the whole surface can be mounted against test doubles.

The redirect route is registered last: it matches a single path segment at the
root, so anything after it would be read as a short code." \
  app/routes/index.js

commit "feat(app): add the app factory

Separate from the entry point so a test can build an app against fakes and drive
it with supertest, without opening a port or connecting to Postgres." \
  app/server.js

commit "feat(app): add the composition root

The one file that knows how the object graph is wired. Every class takes its
collaborators through its constructor and imports none of them — that is what
makes them testable, and the cost is that something has to do the wiring. Better
here than scattered through the codebase as module-level singletons." \
  app/container.js

commit "feat(app): boot with migrations and graceful shutdown

Finishes in-flight requests and closes the pool before exiting, so Postgres
isn't left holding connections open across a container restart." \
  app/index.js

# ---- frontend -------------------------------------------------------------
commit "feat(ui): add an HttpClient facade

The three service files each repeated the same twenty lines: build the URL, set
Content-Type, attach the bearer token, parse JSON, check res.ok, throw, log,
rethrow. They had already drifted — only two of them sent the token, and each
invented its own fallback message." \
  ui/src/services/HttpClient.js

commit "feat(ui): add a token store

The one module that knows the JWT lives in localStorage. Moving to a cookie
later is a change to this file and nowhere else." \
  ui/src/services/tokenStore.js

commit "refactor(ui): move the API services onto HttpClient

These used to take a token argument that every caller threaded down from
AuthContext. The pages no longer pass credentials around." \
  ui/src/services/apiService.js ui/src/services/authService.js \
  ui/src/services/linkService.js

commit "feat(ui): add the request Pipeline component

The landing page's centrepiece: as a real /api/shorten request runs, the layers
it passes through light up in order.

Only latencyMs claims to be measured — it's the real round-trip. The server
doesn't report per-stage timings, so we don't print any." \
  ui/src/components/Pipeline.jsx

commit "feat(ui): add the landing page" \
  ui/src/pages/LandingPage.jsx

commit "feat(ui): add landing page styles" \
  ui/src/index.css

commit "feat(ui): route / to the landing page

The old front door was a design-system screen inventory. It's still there, at
/overview." \
  ui/src/App.jsx

commit "fix(ui): make short-URL truncation host-agnostic

The regex hardcoded the production domain, so on localhost — and on any
self-hosted deployment — the dashboard silently never truncated." \
  ui/src/pages/DashboardPage.jsx

commit "fix(ui): point the dev proxy at port 5050

macOS binds port 5000 to the AirPlay Receiver, which accepts connections and
silently swallows them. You get empty responses and no error anywhere." \
  ui/vite.config.js

commit "chore(ui): add the remaining pages and components" \
  ui/src/pages ui/src/components ui/src/context ui/README.md ui/.env.example

# ---- mcp ------------------------------------------------------------------
commit "feat(mcp): add the API client and auth context" \
  mcp-server/src/apiClient.ts mcp-server/src/authContext.ts

commit "feat(mcp): add the tool surface" \
  mcp-server/src/tools.ts

commit "feat(mcp): add the stdio and HTTP transports" \
  mcp-server/src/index.ts mcp-server/src/http.ts

commit "feat(mcp): expose customAlias on shorten_url" \
  mcp-server/src/tools.ts mcp-server/src/apiClient.ts

commit "test(mcp): cover the tools, API client, and auth context" \
  mcp-server/src/tools.test.ts mcp-server/src/apiClient.test.ts \
  mcp-server/src/authContext.test.ts

commit "docs(mcp): document both transports and token handling" \
  mcp-server/README.md mcp-server/.env.example

# ---- infrastructure -------------------------------------------------------
commit "build(docker): run the stack on Postgres

The database container is behind a profile: by default the stack talks to
whatever DATABASE_URL points at (Neon, Supabase, …) and no database container
runs at all. 'make up-local' brings one up for a fully self-contained stack." \
  docker-compose.yml .env.example

commit "build(docker): add service Dockerfiles and nginx config" \
  app/Dockerfile app/.dockerignore app/.gitignore \
  ui/Dockerfile ui/.dockerignore ui/.gitignore ui/nginx.conf ui/vercel.json \
  mcp-server/Dockerfile mcp-server/.dockerignore mcp-server/.gitignore

commit "build(make): add up, up-local, migrate and psql targets

The JWT_SECRET is generated on first run. The sed invocation is portable: BSD
sed (macOS) requires an argument to -i and GNU sed must not get one." \
  Makefile up.ps1

commit "docs: write the README

Covers the layering, all twelve patterns and what each one earns, and the five
defects the rewrite fixed — each verified against a live Postgres rather than
asserted." \
  README.md

commit "chore: add the commit script" \
  make_commits.sh

# ---- anything not explicitly listed above ---------------------------------
if ! $DRY_RUN && [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -q -m "chore: add remaining project files"
  printf '%3d. %s\n' "$((++COUNT))" "chore: add remaining project files"
fi

echo
echo "──────────────────────────────────────────────"
echo "  $COUNT commits"
$DRY_RUN && echo "  (dry run — nothing was written)"
echo "──────────────────────────────────────────────"
