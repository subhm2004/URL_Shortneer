# Deploying Trunc

Four services, three providers, all on free tiers.

| Service | Where | Why there |
|:--|:--|:--|
| **Database** | [Neon](https://neon.tech) | Serverless Postgres. |
| **Backend** — `app/` | [Render](https://render.com) | Needs a long-running Node process: it serves the redirects. |
| **MCP server** — `mcp-server/` | [Render](https://render.com) | Same — a long-running HTTP service. |
| **Frontend** — `frontend/` | [Vercel](https://vercel.com) | It's a Next.js app. |

```
                        ┌──────────────┐
      browser ─────────▶│    Vercel    │  the web app
                        │  (Next.js)   │  + /api/chat runs here
                        └──┬────────┬──┘
      NEXT_PUBLIC_API_URL  │        │  MCP_SERVER_URL  (server-side only)
                           ▼        ▼
                  ┌──────────────┐  ┌──────────────┐
   short link ───▶│    Render    │◀─│    Render    │
   click          │  (backend)   │  │    (mcp)     │
                  └──────┬───────┘  └──────────────┘
                         │           SHORTENER_API_BASE
                         ▼
                  ┌──────────────┐
                  │     Neon     │
                  └──────────────┘
```

---

## Read this first

Five things will bite you if you don't know them going in.

### 1. Short links live on the **backend** domain

The `/:code` redirect is an Express route running on Render. So:

```
https://trunc-app-api.onrender.com/aB12xY9z    ✅ works
https://trunc.vercel.app/aB12xY9z              ❌ Next's 404 page
```

`BASE_URL` on the backend mints those links, so it must point at Render — or at a
custom domain attached to the Render service. See
[Custom domains](#custom-domains-optional).

### 2. Render's free tier sleeps, and that ruins redirects

A free service spins down after ~15 minutes idle. The next request wakes it, which
takes **roughly 50 seconds**.

For a dashboard that's annoying. For a *URL shortener* it's fatal: someone clicks
your link and stares at a blank tab for a minute. Honestly:

- **Pay.** Render's Starter tier ($7/mo) doesn't sleep. This is the real fix.
- **Ping it.** A cron hitting `/health` every 10 minutes keeps it warm.
- **Accept it** for a portfolio project nobody's clicking at 3am.

It hits the assistant too: `/api/chat` calls the MCP server, so a cold MCP server
means a ~50s first message. Neon also suspends on free tier, but wakes in ~500ms —
that one's fine.

### 3. `NEXT_PUBLIC_` is a security decision, not a naming convention

Next inlines any `NEXT_PUBLIC_*` variable into the JavaScript it ships to the
browser. Anyone can read it in DevTools.

| Variable | Prefix? | Why |
|:--|:--|:--|
| `NEXT_PUBLIC_API_URL` | ✅ yes | The browser calls the backend directly; it has to know the URL. |
| `NEXT_PUBLIC_MCP_URL` | ✅ yes | Only displayed on `/mcp` as copy-paste config. |
| `GROQ_API_KEY` | ❌ **never** | Prefix this and anyone can lift your key and spend your quota. |
| `MCP_SERVER_URL` | ❌ no | Read only by the `/api/chat` route handler, which runs on the server. |

Get this wrong on `GROQ_API_KEY` and the key is public the moment you deploy.

### 4. Those variables are baked in at **build** time

`NEXT_PUBLIC_*` are compiled into the bundle. Changing one in the Vercel dashboard
and hitting refresh does nothing — you must **redeploy**.

### 5. Backend and frontend each need the other's URL

Classic chicken-and-egg: the frontend needs the backend's URL to call the API, and
the backend needs the frontend's URL for CORS and for the OAuth redirect home.
Neither exists until you deploy.

So the order is **backend → MCP → frontend → back to the backend**. Don't skip that
last step, or every API call from your live site is blocked.

---

## Step 1 — Backend on Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect GitHub, pick the repo
3. Fill in:

| Field | Value |
|:--|:--|
| **Name** | `trunc-app-api` |
| **Region** | closest to your Neon region |
| **Root Directory** | `app` ← easy to miss, and nothing works without it |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

4. **Environment Variables:**

| Key | Value |
|:--|:--|
| `DATABASE_URL` | your Neon connection string |
| `JWT_SECRET` | generate a fresh one — see below |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://trunc-app-api.onrender.com` ← this service's own URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000` ← temporary; fixed in Step 4 |
| `FRONTEND_URL` | `http://localhost:3000` ← temporary; fixed in Step 4 |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Use Neon's pooled connection string** — the host contains `-pooler`. Render
> restarts on every deploy and opens fresh connections; the pooler is what stops
> that exhausting Neon's connection limit.

> **Don't set `PORT`.** Render injects it and the config reads `process.env.PORT`.
> Hardcoding it breaks the health check.

5. **Create Web Service.** Migrations run themselves on first boot:

```
[info] Postgres connected → neondb
[info] Migration applied → 001_init.sql
[info] Migration applied → 002_google_oauth.sql
[info] Server listening on http://localhost:10000
```

There is no separate migration step — `app/index.js` runs them before it listens,
so every deploy brings the schema up to date.

6. Verify, and **copy the URL**:

```bash
curl https://trunc-app-api.onrender.com/health
# {"success":true,"status":"ok","env":"production"}
```

---

## Step 2 — MCP server on Render

**New** → **Web Service** → same repo.

| Field | Value |
|:--|:--|
| **Name** | `trunc-mcp-server` |
| **Root Directory** | `mcp-server` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:http` |

**Environment Variables:**

| Key | Value |
|:--|:--|
| `SHORTENER_API_BASE` | `https://trunc-app-api.onrender.com` |
| `NODE_ENV` | `production` |

**No `TRUNC_MCP_TOKEN`.** The HTTP transport reads each user's token from the
`Authorization` header, per request — it never holds one itself. (`TRUNC_MCP_TOKEN`
is stdio-only, for when Claude Desktop runs the server as a local subprocess.)

> **Why a plain `npm install` is enough here.** `NODE_ENV=production` makes npm skip
> devDependencies — where TypeScript and `@types/*` correctly live, since they are
> build tools and have no business in a production image. `mcp-server/.npmrc` pins
> `include=dev`, so the build gets them anyway. The fix lives in the repo rather
> than in a dashboard field someone has to remember to fill in.

Verify, and **copy the URL**:

```bash
curl https://trunc-mcp-server.onrender.com/health
# {"status":"ok","name":"trunc-mcp","version":"0.3.0"}
```

---

## Step 3 — Frontend on Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repo

| Field | Value |
|:--|:--|
| **Framework Preset** | Next.js (autodetected) |
| **Root Directory** | `frontend` ← click **Edit** and set this |

2. **Environment Variables** — note which carry the prefix and which deliberately
   don't:

| Key | Value |
|:--|:--|
| `NEXT_PUBLIC_API_URL` | `https://trunc-app-api.onrender.com` |
| `NEXT_PUBLIC_MCP_URL` | `https://trunc-mcp-server.onrender.com/mcp` |
| `MCP_SERVER_URL` | `https://trunc-mcp-server.onrender.com/mcp` |
| `GROQ_API_KEY` | your key from [console.groq.com/keys](https://console.groq.com/keys) |

`MCP_SERVER_URL` and `GROQ_API_KEY` have **no prefix, on purpose** — see
[point 3](#3-next_public_-is-a-security-decision-not-a-naming-convention). They are
read only by the `/api/chat` route handler, which runs on Vercel's servers and
never in the browser.

> Leave `GROQ_API_KEY` unset and the assistant returns a clean 503 saying it isn't
> configured. Everything else still works.

3. **Deploy**, and copy your Vercel URL.

---

## Step 4 — Close the loop

Your frontend is live but every API call is blocked, because the backend still
doesn't know about it.

**Render → `trunc-app-api` → Environment:**

```
ALLOWED_ORIGINS = https://trunc.vercel.app
FRONTEND_URL    = https://trunc.vercel.app
```

- **`ALLOWED_ORIGINS`** — CORS. Scheme + host, **no trailing slash**.
  Comma-separated for several.
- **`FRONTEND_URL`** — where the Google flow sends the browser once we've issued our
  JWT. Leave it on localhost and a production sign-in redirects your users to their
  own machine.

Save; Render redeploys. Open your Vercel URL and shorten something.

---

## Step 5 — Google sign-in (optional)

Skip this entirely and the app runs fine: the routes aren't mounted, and the
frontend hides the button because it *asks* the backend rather than assuming.

### Google Cloud Console

**APIs & Services → Credentials → OAuth 2.0 Client ID → Web application**

| Field | Value |
|:--|:--|
| **Authorized JavaScript origins** | *leave empty* |
| **Authorized redirect URIs** | `https://trunc-app-api.onrender.com/api/auth/google/callback` |

JavaScript origins are for browser-side flows. This is a server-side
authorization-code flow — no script of ours ever talks to Google — so only the
redirect URI matters. Keep your `http://localhost:5050/…` entry alongside it for
local development.

> It must match **byte for byte**. A trailing slash, `http` vs `https`, the wrong
> port — any of them fails with only `redirect_uri_mismatch` to go on. The backend
> logs the URI it actually sent, so you can compare the two side by side.

### OAuth consent screen

While the app is in **Testing**, only listed accounts can sign in.

**OAuth consent screen → Test users → + ADD USERS** → your own Google address.

Miss this and you get `Access blocked: Trunc has not completed the Google
verification process` — which says nothing about the actual cause, and is the
single most common way to lose an hour here.

### Render → `trunc-app-api` → Environment

| Key | Value |
|:--|:--|
| `GOOGLE_CLIENT_ID` | from the console |
| `GOOGLE_CLIENT_SECRET` | from the console |
| `GOOGLE_REDIRECT_URI` | `https://trunc-app-api.onrender.com/api/auth/google/callback` |

The button appears on its own once these are set.

---

## Which URL goes where

Every arrow is one service telling another where to find it.

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
| Frontend | `MCP_SERVER_URL` | MCP — used by `/api/chat`, server-side only |

---

## Custom domains (optional)

Say you own `trunc.sh`:

| Subdomain | Points at | Purpose |
|:--|:--|:--|
| `trunc.sh` | Render (backend) | Short links: `trunc.sh/aB12xY9z` |
| `app.trunc.sh` | Vercel | The web app |
| `mcp.trunc.sh` | Render (mcp) | MCP endpoint |

The **apex goes on the backend**, not the frontend. The apex is what makes a short
link short, and short links are served by the backend.

```bash
# Render → backend
BASE_URL            = https://trunc.sh
ALLOWED_ORIGINS     = https://app.trunc.sh
FRONTEND_URL        = https://app.trunc.sh
GOOGLE_REDIRECT_URI = https://trunc.sh/api/auth/google/callback   # + add it in Google's console

# Vercel
NEXT_PUBLIC_API_URL = https://trunc.sh
NEXT_PUBLIC_MCP_URL = https://mcp.trunc.sh/mcp
MCP_SERVER_URL      = https://mcp.trunc.sh/mcp
```

Existing links keep working: `shortUrl` is **derived** from `BASE_URL` at read time,
never stored. That was a deliberate choice, and this is the payoff.

---

## Troubleshooting

**Every API call fails with a CORS error.**
`ALLOWED_ORIGINS` doesn't exactly match your Vercel origin. Scheme + host, no
trailing slash: `https://trunc.vercel.app`.

**API calls 404 against the Vercel domain.**
`NEXT_PUBLIC_API_URL` wasn't set at build time. Set it, then **redeploy** — Next
bakes it into the bundle.

**A short link shows the app's 404 page.**
You clicked a link on the *Vercel* domain. Short links live on the backend domain —
check `BASE_URL`.

**Backend won't boot: `Missing required environment variable(s): DATABASE_URL`.**
Exactly what it says. The config validates at boot on purpose, so you find out here
rather than on someone's first request.

**Google sign-in returns to `localhost:3000` in production.**
`FRONTEND_URL` is still on localhost. See Step 4.

**`redirect_uri_mismatch`.**
The URI in Google's console and `GOOGLE_REDIRECT_URI` differ. The backend logs the
one it actually sent — compare them character by character.

**`Access blocked: … has not completed the Google verification process`.**
Your account isn't in the consent screen's **Test users** list.

**The assistant says "Chat isn't configured".**
`GROQ_API_KEY` is missing on Vercel. And check the name: **no `NEXT_PUBLIC_`
prefix.**

**The assistant can't reach the MCP server.**
`MCP_SERVER_URL` is unset or wrong on Vercel. It's a *server-side* variable, so it
must not carry the prefix either.

**The first message to the assistant times out.**
Free-tier cold start on the MCP server, ~50 seconds. The route allows 60s
(`maxDuration`), so it should just make it — and the second message will be fast.

**Everyone got logged out after a deploy.**
You changed `JWT_SECRET`. Every previously-issued token is now invalid. Set it once
and never touch it.
