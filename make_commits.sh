#!/usr/bin/env bash
#
# make_commits.sh — turn the current working tree into a sequence of atomic,
# reviewable commits, appended to the existing history.
#
# The commits are ordered the way the work was actually layered: the old frontend
# comes out, the new one goes in, then the features that build on it, then the
# fixes those features surfaced. A reviewer can read `git log` top to bottom and
# follow how it happened.
#
# Timestamps are real. This does not backdate anything, and you should not make it:
# a fabricated author date is trivially spotted (GitHub shows author and commit
# dates separately) and it turns honest work into something you'd have to defend.
#
# Usage:
#   ./make_commits.sh              # commit
#   ./make_commits.sh --dry-run    # print the plan, touch nothing
#
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# Safety rails
# ---------------------------------------------------------------------------

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit — the working tree is clean."
  exit 0
fi

# A .env holding a live database password, a Google client secret, or a Groq API
# key must never reach a remote. .gitignore covers them, but a typo in .gitignore
# would be a very bad day, so this checks rather than assumes.
for env_file in .env app/.env frontend/.env frontend/.env.local mcp-server/.env; do
  if [[ -f "$env_file" ]] && ! git check-ignore -q "$env_file"; then
    echo "REFUSING TO RUN: $env_file exists and is NOT gitignored."
    echo "It would be committed. Fix .gitignore first."
    exit 1
  fi
done

COUNT=0

commit() {
  local message="$1"; shift

  if $DRY_RUN; then
    printf '%3d. %s\n' "$((++COUNT))" "${message%%$'\n'*}"
    return
  fi

  local staged=false
  for path in "$@"; do
    # `git add -A <path>` stages deletions too, which matters: most of these
    # commits remove files as well as add them.
    if [[ -e "$path" ]] || git ls-files --error-unmatch "$path" > /dev/null 2>&1; then
      git add -A -- "$path" 2>/dev/null || true
      staged=true
    fi
  done

  if ! $staged || git diff --cached --quiet; then
    echo "  (skipped, nothing to stage) ${message%%$'\n'*}"
    return
  fi

  git commit -q -m "$message"
  printf '%3d. %s\n' "$((++COUNT))" "${message%%$'\n'*}"
}

# ---------------------------------------------------------------------------
# The history
# ---------------------------------------------------------------------------

# ---- housekeeping ---------------------------------------------------------

commit "fix(docker): restore the root .env.example

It was deleted as 'unused'. It is not: the first thing \`make up\` does is
\`cp .env.example .env\`, so both Makefile and up.ps1 were broken without it." \
  .env.example

# ---- the frontend replacement --------------------------------------------

commit "refactor(frontend): replace the Vite SPA with Next.js 15 and TypeScript

The old frontend was a JavaScript Vite SPA. This is a typed Next.js app: file
routing, server components where they help, and a build that can be deployed to
Vercel without a separate static-hosting story.

Everything the old app did, this does — and the type checker now catches the class
of mistake that produced most of the frontend bugs in this repo's history: a field
renamed on the server and missed in the client." \
  frontend/package.json frontend/package-lock.json frontend/tsconfig.json \
  frontend/next.config.ts frontend/postcss.config.mjs frontend/eslint.config.mjs \
  frontend/.gitignore frontend/.env.example \
  frontend/vite.config.js frontend/index.html frontend/eslint.config.js \
  frontend/vercel.json frontend/nginx.conf frontend/README.md frontend/public \
  frontend/src/App.jsx frontend/src/main.jsx frontend/src/index.css \
  frontend/src/pages frontend/src/services frontend/src/context/AuthContext.js \
  frontend/src/context/AuthProvider.jsx frontend/src/context/useAuth.js \
  frontend/src/components/ClicksChart.jsx frontend/src/components/ClicksOverTimeChart.jsx \
  frontend/src/components/Footer.jsx frontend/src/components/MiniFlows.jsx \
  frontend/src/components/Navbar.jsx frontend/src/components/Pipeline.jsx \
  frontend/src/components/PrivateRoute.jsx frontend/src/components/Spinner.jsx

commit "feat(frontend): the dark design system

Dark-only, deliberately. The product is about watching a request execute — that
reads as an instrument panel, and instrument panels are dark.

Two typefaces with distinct jobs: Inter for anything a human wrote, IBM Plex Mono
for anything the machine says. Every colour is declared once; there is no raw hex
below the token block." \
  frontend/src/app/globals.css frontend/src/app/layout.tsx

commit "feat(frontend): a typed API facade and token store

One entry point for every call to the backend. Without it each feature
re-implements the same twenty lines — and that duplication doesn't merely bloat,
it *drifts*: in the previous frontend two of the three service files sent the auth
token and one didn't, and each had invented its own fallback error message.

tokenStore is the only module that knows the JWT lives in localStorage. Moving it
to a cookie later is a change to that one file." \
  frontend/src/lib/api.ts frontend/src/lib/types.ts frontend/src/lib/tokenStore.ts

commit "feat(frontend): AuthProvider

\`ready\` is the load-bearing part. The token cannot be read during render — Next
renders on the server first, where there is no localStorage — so reading it in a
useState initialiser produces different HTML on the server and the client and
React throws a hydration mismatch.

So \`ready\` is false for the first client render, matching the server, and true
once the effect has run. Anything that branches on auth state has to wait for it,
or it flashes the signed-out view at a signed-in user." \
  frontend/src/context/AuthProvider.tsx

commit "feat(frontend): the pipeline terminal

As a real POST /api/shorten runs, the work it does prints itself out, line by
line, the way a machine reports in.

One rule governs every pixel: nothing is invented. No fake hex addresses, no
fabricated per-stage timings. Every check listed is a check the server genuinely
performs, and the only measured number is the round-trip the caller actually
timed. The typing, the scanlines and the rain are how it's *revealed* — not what
is claimed. The moment it prints plausible nonsense to look impressive, nothing
else on it can be believed either." \
  frontend/src/components/Pipeline.tsx frontend/src/components/TypeText.tsx \
  frontend/src/components/MatrixRain.tsx

commit "feat(frontend): the decrypt animation for a resolved short code

The code is the one thing the user is waiting for, and it arrives in a single
response — there is no progress to show. Scrambling it into place gives that
instant a shape, and it lands as the pipeline above finishes. The animation *is*
the feedback." \
  frontend/src/components/ScrambleText.tsx

commit "feat(frontend): the shortener

Form, then live pipeline, then the decrypted code, then the finished link. The
sequence is deliberate: each beat resolves the one before it." \
  frontend/src/components/Shortener.tsx

commit "feat(frontend): the landing page" \
  frontend/src/app/page.tsx frontend/src/components/Reveal.tsx

commit "feat(frontend): the dashboard

A proportional bar behind each row, scaled to the busiest link — it reads as a
chart without needing to be one. The click chart is plain SVG: one line and one
filled area, and importing a charting library for that would ship more bytes than
the rest of the page put together." \
  frontend/src/app/dashboard/page.tsx frontend/src/components/Sparkline.tsx

commit "feat(frontend): auth pages, MCP guide, and a 404" \
  frontend/src/app/login frontend/src/app/register frontend/src/app/mcp \
  frontend/src/app/not-found.tsx

commit "build(docker): serve the frontend as a Next.js standalone build

The old Dockerfile built static files and served them from nginx. Next needs a
Node process, so this is a three-stage build that ships the standalone output and
nothing else — no source, no build toolchain.

NEXT_PUBLIC_* arrive as build args, not environment: Next inlines them into the
client bundle when it compiles, so setting them at runtime would do nothing." \
  frontend/Dockerfile frontend/.dockerignore docker-compose.yml

# ---- Google OAuth ---------------------------------------------------------

commit "feat(db): let a user exist without a password

A Google user never sets one, and password_hash was NOT NULL — which made such a
row impossible to insert at all.

google_id keys on Google's \`sub\`, never on the email: a Google user can change
their email address, and keying on it would either lose them their account or hand
it to whoever later picks up their old address.

A CHECK constraint requires every row to be reachable by *some* credential.
Without it, a bug that dropped both would leave an account nobody — including its
owner — could ever sign in to." \
  app/db/migrations/002_google_oauth.sql

commit "feat(auth): sign in with Google

The OAuth 2.0 authorization-code flow. Google is another way to obtain *our* JWT;
everything downstream — the dashboard, MCP, every protected route — is unchanged.

Three decisions worth the reader's attention:

- Account linking happens only on a Google-verified email. If a user signed up
  with a password and later clicks 'Continue with Google' on the same address, the
  two are linked and the password keeps working. That is safe ONLY because a
  profile whose email Google hasn't verified is refused outright; without that
  check this branch is an account-takeover primitive.

- The \`state\` nonce is the CSRF defence, and the attack it stops runs backwards
  from the usual one: without it, an attacker completes their own consent and
  tricks your browser into our callback with *their* code — silently signing you
  into the attacker's account, where everything you then shorten lands in their
  dashboard.

- The JWT comes back in the URL *fragment*, not the query string. A fragment is
  never sent to any server — not ours, not in a Referer header, not into access or
  proxy logs. The callback page strips it with history.replaceState the moment it
  has read it.

The whole feature is optional: with no client id configured the routes aren't
mounted and the frontend hides the button, because it asks rather than assumes." \
  app/services/GoogleAuthService.js app/config/index.js app/container.js \
  app/controllers/AuthController.js app/routes/index.js app/server.js \
  app/repositories/UserRepository.js app/services/AuthService.js \
  app/package.json app/package-lock.json app/.env.example \
  frontend/src/components/GoogleButton.tsx frontend/src/hooks/useProviders.ts \
  frontend/src/app/auth frontend/src/app/login frontend/src/app/register

commit "fix(auth): password login on a Google-only account returned a 500

bcrypt.compare(password, null) *throws* — it does not return false. So trying to
password-login an account that only has Google produced a 500 rather than a clean
rejection, and that 500 confirmed the account existed. Now it is the same 401,
with the same message, as every other failed login." \
  app/services/AuthService.js

commit "feat(auth): GET /api/auth/me

The JWT carries only an id, deliberately. Putting a name or an avatar in the token
means a stale token serves a stale name. Anything the UI *displays* is fetched, not
decoded.

A 401 here means the token is stale — expired, or JWT_SECRET rotated — so the
client clears it. Leaving it in place would keep every request failing while the UI
insisted the user was signed in." \
  app/controllers/AuthController.js app/services/AuthService.js app/routes/index.js

# ---- the assistant --------------------------------------------------------

commit "feat(chat): an MCP client, and an assistant that shows its work

The chat is a genuine MCP client: it asks our MCP server what tools exist and hands
that list to the model. Add a tool to mcp-server/src/tools.ts and it appears here
with no change to this code.

It runs entirely server-side, and that is the point — GROQ_API_KEY has no
NEXT_PUBLIC_ prefix, so Next refuses to inline it into the client bundle. The
browser never sees the key, and never sees the MCP server's address either.

And it does not hide the tool calls. The arguments, the raw result and the latency
are all on screen. Most chat UIs bury this: you get an answer with no way to tell
whether the model looked anything up or simply made it up. An assistant you cannot
check is an assistant you cannot trust." \
  frontend/src/lib/mcpClient.ts frontend/src/app/api frontend/src/app/chat

commit "fix(chat): zero-argument tools could never be called

For a tool that takes no arguments, Groq sends the *string* \"null\". Parsing that
yields \`null\`, and forwarding it produced \`arguments: null\`, which the MCP
server's schema rejects as 'expected record'.

The effect was that whoami and get_my_links — half the tool surface — failed every
single time, and the model simply retried until it ran out of rounds. The
round cap, added to bound the cost of a bad prompt, is what stopped it burning
tokens indefinitely." \
  frontend/src/app/api

# ---- brand and chrome -----------------------------------------------------

commit "feat(brand): the logo — a chain link, severed

One half in the foreground colour, one in the brand green, with a deliberate gap
between them. A link, cut short: the product's name and the product's job in one
glyph.

Two arcs rather than one path, so the halves can carry different colours and the
gap stays a real gap at any size — including 16px, where a chain link usually turns
to mush." \
  frontend/src/components/Logo.tsx frontend/src/app/icon.svg

commit "feat(ui): navbar — centred nav, user menu, scroll progress

The links are absolutely centred, not laid out between the logo and the buttons:
\`justify-center\` inside a flex child centres them in the *leftover* space, and
since the two sides are different widths that lands visibly off-centre.

The bar is borderless at the top of the page and only separates itself once you've
scrolled — a hard line under a header sitting on empty space is a line drawn for no
reason. The reading-progress bar sits on that same edge, so one line does two jobs
instead of two lines competing." \
  frontend/src/components/Navbar.tsx frontend/src/hooks/useScrollProgress.ts

commit "feat(ui): a footer with a status indicator that actually checks

Every footer has a green 'all systems operational' dot and almost none of them are
wired to anything. This one pings /health, and says so when the API is down — which
is the only thing that makes the green dot mean anything on the days it is green." \
  frontend/src/components/Footer.tsx frontend/src/components/StatusDot.tsx

commit "fix(ui): the status dot reported the API down while it was up

The backend's health check lives at /health, outside /api — so it wasn't covered by
the proxy rule, and the indicator got a 404 from Next while the API was serving
requests perfectly well.

A status light that is red when everything is fine is worse than no status light: it
trains you to ignore it, and then it is useless on the day it's telling the truth." \
  frontend/next.config.ts

commit "fix(ui): every space vanished from scrambled text

Each character is rendered in its own inline-block span, and an inline-block
containing only a regular space collapses to zero width. 'CHAIN OF RESPONSIBILITY'
rendered as 'CHAINOFRESPONSIBILITY'.

It never showed while this was only used on short codes, which have no spaces in
them. Spaces now don't scramble at all — cycling a glyph through the gap between
words makes the text unreadable while it settles — and they render as
non-breaking spaces so they can't collapse." \
  frontend/src/components/ScrambleText.tsx

# ---- custom aliases -------------------------------------------------------

commit "fix(security): a custom alias requires an account

CustomAliasStrategy's own comment said 'lets a signed-in user pick their own slug'.
It was the only thing enforcing that — the code let anyone claim one.

A generated code and an alias are not the same kind of thing. A generated code is
drawn from a space nobody else wants; an alias is a claim on a scarce, *global*
namespace — there is exactly one /google, one /paypal, one /launch. Handing those to
anonymous callers is handing out a squatting tool, and there is nobody to take them
back from." \
  app/services/UrlService.js

commit "feat(links): custom aliases in the shortener

The backend has supported them all along — validation, reserved words, a 409 when
one is taken — and the form simply never offered them. A whole feature, built and
hidden.

The client repeats the format rule so the user finds out before a round-trip, but
the server remains the only thing enforcing it: it owns the reserved-word list and
the 'already taken' answer, and it is the only one that can." \
  frontend/src/components/Shortener.tsx frontend/src/app/page.tsx

# ---- rate limiting --------------------------------------------------------

commit "feat(security): rate limiting with a token bucket

A URL shortener with no rate limit is an abuse tool: /api/shorten is how a spammer
mints phishing links on your domain in bulk, and an unlimited /api/auth/login is a
CPU-exhaustion attack with a free password guess attached, because bcrypt is slow
by design.

Token bucket, chosen over the three obvious alternatives for a stated reason.
Fixed-window lets 2x the limit through across a boundary. Sliding-window log grows
its memory with traffic — a strange property for the thing whose job is to survive
a flood. Sliding-window counter forbids bursts, and bursts are the *normal* shape
here: someone pastes four links in ten seconds and then nothing for an hour.
Refusing their fourth link is punishing a real user to stop an attacker who could
have waited. Token bucket allows the burst and caps the sustained rate — which is
what AWS, Stripe and GitHub all use a variant of.

Three buckets, because the three endpoints are abused differently; a Null Object
limiter when it's disabled, so the middleware keeps exactly one path; and the IETF
RateLimit-* headers plus Retry-After, so a well-behaved client backs off before it
is refused rather than after. Behind the Strategy interface, a Redis-backed sibling
is the fix for multi-instance and nothing else changes.

Deliberately NOT applied to the redirect: that is the product. A popular link should
be hammered — throttling it would throttle the very success the app exists for." \
  app/rateLimit app/middleware/rateLimit.js app/config/index.js \
  app/container.js app/server.js app/routes/index.js

# ---- link management ------------------------------------------------------

commit "perf(db): keyset pagination and edit tracking

OFFSET pagination is wrong twice: it is O(n) — deep pages make Postgres walk and
discard every row before them — and it is unstable, so a link created while someone
is on page 2 shifts every row down one and they see a row twice or never. Keyset
compares the (created_at, id) tuple against the last row seen: O(log n) on the
index, and immune to inserts because the cursor names a position in the data, not a
count of rows. The index is widened to cover the whole key, and id is the tiebreak
so a page boundary between two same-millisecond rows can't drop or duplicate one." \
  app/db/migrations/003_links_management.sql

commit "feat(links): paginate, delete, and repoint

my-links now returns a page and an opaque cursor rather than every link a user has
ever created — fine at ten, fatal at ten thousand. The cursor is opaque on purpose:
decode it and the client is coupled to a pagination scheme we can then never change.

DELETE and PATCH enforce ownership in the WHERE clause, not a SELECT-then-write —
one round trip, and no TOCTOU gap where the row changes owner between the two
statements. Both report someone else's link as 404, never 403: a 403 confirms the
link exists and belongs to somebody.

Two hazards the code has to answer for:

- Editing re-runs the full validation chain. Skipping it would be a hole straight
  through every rule: shorten something harmless, then repoint it to
  javascript:alert(1).
- The caching decorator evicts on delete and on edit. Forget that line and the
  redirect — which reads from the cache — keeps serving a link that is gone from
  Postgres, for a full TTL, while its owner watches the delete button do nothing." \
  app/repositories/UrlRepository.js app/repositories/CachedUrlRepository.js \
  app/services/UrlService.js app/controllers/LinkController.js

commit "fix(analytics): rank top links in SQL, not in Node

overview() sorted every one of a user's links in Node to find the busiest five.
Wasteful even when it worked — and once my-links became paginated, wrong: it would
have ranked the top five out of whichever twenty rows the first page happened to
hold. It's now ORDER BY click_count DESC LIMIT 5, where it always should have been." \
  app/services/AnalyticsService.js app/repositories/UrlRepository.js \
  app/repositories/CachedUrlRepository.js

commit "feat(dashboard): delete, edit, and load-more

Row actions with confirm-and-edit modals — deletion names the click count it will
destroy, because it cascades and there is no undo. Editing says plainly that the
short code stays the same, since that is the whole reason to edit rather than
recreate. Load-more appends a page rather than refetching, so it keeps scroll
position. The modal closes on Escape and on an outside click, both." \
  frontend/src/app/dashboard/page.tsx frontend/src/lib/api.ts frontend/src/lib/types.ts

# ---- fixes ----------------------------------------------------------------

commit "fix(app): report a busy port legibly

Without an 'error' listener the server emits an unhandled event and the process
dies behind a stack trace that never names the actual problem. The usual cause is a
previous run that was never stopped, and the fix is one \`lsof\` away — so the log
now says that." \
  app/index.js

commit "test: 42 unit tests, and the DI seam pays for itself

The README kept claiming a unit test for UrlService 'hands it a fake repository —
no Postgres, no Express, no network'. This makes that true. Forty-two tests run in
about 200ms against injected fakes, which is the entire return on the
dependency-injection seam: nothing is imported, so everything can be replaced.

They cover the logic with edges, not the plumbing — collision retry and its
give-up, the login enumeration guard, the Google-account bcrypt crash, keyset
pagination's fetch-one-extra probe and its clamp, ownership-as-404, and the token
bucket's refill curve. That last one is why the limiter's clock is injected: 'one
token every six seconds' is verified against a fake clock in microseconds, instead
of by actually waiting six seconds — which is how test suites get slow enough that
people stop running them.

Uses node:test, already in Node 20. No new dependency for something the runtime
ships." \
  app/test app/rateLimit/TokenBucketLimiter.js app/package.json

commit "test: extend the smoke test to the new surface, and keep it honest

Grows from 37 checks to 54: pagination (no row seen twice across pages, a malformed
cursor serving page one rather than a 500), delete and edit (the validation chain
re-running on edit, ownership as 404, and — the one that matters — the redirect
going dead the instant a link is deleted, which only fails if the cache isn't
evicted), and rate limiting (the bucket holding exactly its limit, 429 carrying
Retry-After, and the redirect never being throttled).

The concurrency check now polls for convergence rather than sleeping. Clicks are
written after the response — the point of the Observer seam — so the count is
eventually consistent. A fixed 3s sleep raced the writes against a remote Postgres
and would have failed in CI at random. A flaky check is worse than no check: people
learn to re-run it, and this is the check guarding the lost-increment fix." \
  app/scripts/smoke.mjs .github/workflows/ci.yml

commit "fix(chat): allow the assistant 60 seconds

Vercel kills a serverless function at 10 seconds by default, and this one waits on
Groq, then the MCP server, then Groq again. If the MCP server is on a free Render
tier it may be cold, which alone costs ~50s — so the default severed the request
mid-flight and the user saw a generic failure with nothing to debug." \
  frontend/src/app/api

# ---- docs -----------------------------------------------------------------

commit "docs: one README, and everything in it

Folds the deployment guide into the README and deletes DEPLOYMENT.md. Two
documents meant two places to look and two places to drift; the wiring of four
services across three providers is not a footnote, it is the part people actually
get stuck on.

Eight Mermaid diagrams carry the parts that don't survive being written as prose —
the system topology, the layered backend, the request as it passes through the
patterns, the schema, the two MCP clients, the Groq tool loop, the OAuth exchange,
and CI. Each one validated against Mermaid's own parser, because a diagram with a
syntax error doesn't degrade, it renders as a wall of raw text.

The design-pattern section now leads with what would break without each pattern
and shows the actual code. And the deployment section leads with the five things
that will bite you, because every one of them cost time to learn:

- short links are served by the backend, so BASE_URL must point at Render
- Render's free tier sleeps ~50s, which is merely annoying for a dashboard and
  fatal for a redirect
- NEXT_PUBLIC_ is a security decision, not a naming convention: prefix
  GROQ_API_KEY and the key ships to every browser that loads the page
- those variables are baked in at build time, so changing one needs a redeploy
- the backend and frontend each need the other's URL, so the order matters" \
  README.md DEPLOYMENT.md .gitignore

commit "chore: add the commit script" \
  make_commits.sh

# ---- safety net -----------------------------------------------------------
# Nothing should reach here — every changed path is named above. If something
# does, it's a file added after this script was last updated, and a labelled
# catch-all is better than leaving it uncommitted.

if ! $DRY_RUN && [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -q -m "chore: remaining files"
  printf '%3d. %s\n' "$((++COUNT))" "chore: remaining files"
fi

echo
echo "──────────────────────────────────────────────"
echo "  $COUNT commits"
$DRY_RUN && echo "  (dry run — nothing was written)"
echo "  Push with:  git push origin main"
echo "──────────────────────────────────────────────"
