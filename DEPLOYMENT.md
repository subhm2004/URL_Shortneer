# Deploying Trunc

Four pieces, three providers, all on free tiers:

| Piece | Where | Why there |
|:--|:--|:--|
| **Database** | [Neon](https://neon.tech) | Serverless Postgres. You already have this. |
| **Backend** (`app/`) | [Render](https://render.com) | Needs a long-running Node process — it serves the redirects. |
| **MCP server** (`mcp-server/`) | [Render](https://render.com) | Same: a long-running HTTP service. |
| **Frontend** (`ui/`) | [Vercel](https://vercel.com) | It's a static Vite build. Vercel does this best. |

```
                    ┌──────────────┐
   browser ────────▶│    Vercel    │  the app UI
                    │  (frontend)  │
                    └──────┬───────┘
                           │ VITE_API_URL
                           ▼
                    ┌──────────────┐        ┌──────────┐
   short link ─────▶│    Render    │───────▶│   Neon   │
   click            │  (backend)   │        │ Postgres │
                    └──────▲───────┘        └──────────┘
                           │ SHORTENER_API_BASE
                    ┌──────┴───────┐
   Claude ─────────▶│    Render    │  MCP server
                    │    (mcp)     │
                    └──────────────┘
```

---

## Read this before you start

Three things will bite you if you don't know them up front.

### 1. Short links live on the **backend** domain, not the Vercel one

The `/:code` redirect is an Express route. It runs on Render. So your short links
will look like:

```
https://trunc-api.onrender.com/aB12xY9z     ✅ works
https://trunc.vercel.app/aB12xY9z           ❌ shows the SPA's 404 page
```

That second one fails because `ui/vercel.json` rewrites *every* path to
`index.html` — Vercel never even asks your backend. This is correct behaviour for
a single-page app, and it's why `BASE_URL` must point at Render.

If you want pretty links (`trunc.sh/aB12xY9z`), put a **custom domain on the
Render backend service** and set `BASE_URL` to it. See [Custom domains](#custom-domains-optional).

### 2. Render's free tier sleeps — and that ruins redirects

A free Render service spins down after ~15 minutes of no traffic. The next request
wakes it, which takes **roughly 50 seconds**.

For a dashboard that's annoying. For a *URL shortener* it's fatal: someone clicks
your link and stares at a blank tab for a minute. Your options, honestly:

- **Pay.** Render's Starter tier ($7/mo) doesn't sleep. This is the real fix.
- **Ping it.** A cron job hitting `/health` every 10 minutes keeps it warm. Free, a
  bit of a hack, and against the spirit of the free tier — but it works.
- **Accept it** for a portfolio/demo project where nobody's clicking links at 3am.

Neon also auto-suspends on free tier, but it wakes in ~500ms. That one's fine.

### 3. Backend and frontend each need the other's URL

Classic chicken-and-egg: the frontend needs the backend's URL to call the API, and
the backend needs the frontend's URL to allow it through CORS. Neither exists until
you deploy.

So the order below is: **backend → frontend → come back and fix the backend's CORS.**
Don't skip that last step or every API call from your live site will fail.

---

## Step 0 — Rotate your database password

You pasted your Neon connection string into a chat. Rotate it before it goes
anywhere near a production deploy.

1. Neon dashboard → your project → **Roles**
2. Next to `neondb_owner` → **Reset password**
3. Copy the **new** connection string — the one ending in `-pooler...`

> Use the **pooled** connection string (the host contains `-pooler`). Render can
> restart your service and open new connections; the pooler is what keeps that from
> exhausting Neon's connection limit.

Update `app/.env` locally with the new string too, so local dev keeps working.

---

## Step 1 — Backend on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub account, pick the `URL_Shortneer` repo
3. Fill in:

| Field | Value |
|:--|:--|
| **Name** | `trunc-api` |
| **Region** | pick the one closest to your Neon region (`us-east` if you kept the default) |
| **Root Directory** | `app` ← **easy to miss, and nothing works without it** |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (read [the warning above](#2-renders-free-tier-sleeps--and-that-ruins-redirects)) |

4. Scroll to **Environment Variables** and add:

| Key | Value |
|:--|:--|
| `DATABASE_URL` | your **new** pooled Neon string from Step 0 |
| `JWT_SECRET` | generate a fresh one — see below. **Do not reuse your local one.** |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://trunc-api.onrender.com` ← your own Render URL |
| `ALLOWED_ORIGINS` | `http://localhost:5173` ← temporary, you'll fix this in Step 4 |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Don't set `PORT`.** Render injects it. Our config reads `process.env.PORT`, so it
> just works. Hardcoding it will break the health check.

5. **Create Web Service.**

Watch the logs. You should see the migrations run themselves on first boot:

```
[info] Postgres connected → neondb
[info] Migration applied → 001_init.sql
[info] Container built {"shortCodeStrategy":"nanoid","cache":"in-memory"}
[info] Server listening on http://localhost:10000
```

**There is no separate migration step.** `app/index.js` calls `migrate()` before it
starts listening, so every deploy brings the schema up to date automatically.

6. Verify:

```bash
curl https://trunc-api.onrender.com/health
# {"success":true,"status":"ok","env":"production"}
```

**Copy your backend URL.** You need it twice in the next steps.

---

## Step 2 — MCP server on Render

Same flow, different settings.

1. **New** → **Web Service** → same repo
2. Fill in:

| Field | Value |
|:--|:--|
| **Name** | `trunc-mcp` |
| **Root Directory** | `mcp-server` |
| **Build Command** | `npm install --include=dev && npm run build` ← see the note below |
| **Start Command** | `npm run start:http` |

> **Why `--include=dev`?** TypeScript and `@types/express` are build-time tools —
> they belong in `devDependencies`, and shipping them to production would be wrong.
> But setting `NODE_ENV=production` (which you want, for the runtime) makes `npm
> install` skip devDependencies entirely, so the build then has no compiler and no
> type definitions. `--include=dev` installs them for the build; they simply aren't
> used at runtime.
>
> The backend (`app/`) has no build step and no devDependencies it needs, so a plain
> `npm install` is fine there.

3. Environment variables:

| Key | Value |
|:--|:--|
| `SHORTENER_API_BASE` | `https://trunc-api.onrender.com` ← your backend from Step 1 |
| `NODE_ENV` | `production` |

That's all it needs. **No `TRUNC_MCP_TOKEN`** — the HTTP transport reads each user's
token from the `Authorization` header per request. It never holds one itself.
(`TRUNC_MCP_TOKEN` is a *stdio-only* thing, for when Claude Desktop runs the server
as a local subprocess.)

4. Verify:

```bash
curl https://trunc-mcp.onrender.com/health
# {"status":"ok","name":"trunc-mcp","version":"0.3.0"}
```

**Copy this URL too.**

---

## Step 3 — Frontend on Vercel

1. [vercel.com/new](https://vercel.com/new) → import the `URL_Shortneer` repo
2. Fill in:

| Field | Value |
|:--|:--|
| **Framework Preset** | Vite (it should autodetect) |
| **Root Directory** | `ui` ← **click "Edit" and set this** |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |

3. Expand **Environment Variables** and add both:

| Key | Value |
|:--|:--|
| `VITE_API_URL` | `https://trunc-api.onrender.com` |
| `VITE_HOSTED_MCP_URL` | `https://trunc-mcp.onrender.com/mcp` |

> `VITE_API_URL` is **not optional in production.** Locally it's empty, because the
> Vite dev server proxies `/api` to your backend. On Vercel there is no proxy — if
> this is unset, the frontend calls `https://trunc.vercel.app/api/shorten`, which
> doesn't exist, and every request 404s.
>
> Vite inlines `VITE_*` vars **at build time**, not runtime. Change one, and you must
> **redeploy** for it to take effect. Setting it in the dashboard and hitting refresh
> does nothing.

4. **Deploy.** Copy your Vercel URL.

---

## Step 4 — Close the loop (CORS)

Your frontend is live but every API call is still being blocked, because the backend
doesn't know about it yet. Go back and fix that:

1. Render → `trunc-api` → **Environment**
2. Change `ALLOWED_ORIGINS` to your Vercel URL:

```
ALLOWED_ORIGINS=https://trunc.vercel.app
```

Multiple origins are comma-separated, no spaces:

```
ALLOWED_ORIGINS=https://trunc.vercel.app,https://trunc.sh
```

3. **Save.** Render redeploys automatically.

Now open your Vercel URL and shorten something. If it works, you're done.

---

## Which URL goes where — the cheat sheet

This is the part everyone gets wrong. Every arrow is one service telling another
where to find it.

| Service | Variable | Points at | Example |
|:--|:--|:--|:--|
| Backend | `DATABASE_URL` | → Neon | `postgresql://…-pooler…neon.tech/neondb?sslmode=require` |
| Backend | `BASE_URL` | → **itself** | `https://trunc-api.onrender.com` |
| Backend | `ALLOWED_ORIGINS` | → Vercel | `https://trunc.vercel.app` |
| MCP | `SHORTENER_API_BASE` | → Backend | `https://trunc-api.onrender.com` |
| Frontend | `VITE_API_URL` | → Backend | `https://trunc-api.onrender.com` |
| Frontend | `VITE_HOSTED_MCP_URL` | → MCP | `https://trunc-mcp.onrender.com/mcp` |

Read it as a sentence: *the backend mints links against itself, lets the Vercel app
in, and talks to Neon. The MCP server and the frontend both talk to the backend.*

---

## Connecting Claude to the deployed MCP server

Once it's live, nobody needs to run anything locally.

1. Open `https://trunc.vercel.app/mcp` and sign in — the page shows your JWT
2. In Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trunc": {
      "url": "https://trunc-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer <paste-your-jwt>"
      }
    }
  }
}
```

3. Quit Claude Desktop completely (Cmd+Q) and reopen it.

The token is yours and personal — it identifies *your* account. Anyone holding it can
create links as you, so don't paste it into a screenshot or a repo.

---

## Custom domains (optional)

Say you own `trunc.sh`:

| Subdomain | Points at | Purpose |
|:--|:--|:--|
| `trunc.sh` | Render (backend) | Short links: `trunc.sh/aB12xY9z` |
| `app.trunc.sh` | Vercel | The web app |
| `mcp.trunc.sh` | Render (mcp) | MCP endpoint |

Put the **apex domain on the backend**, not the frontend — the apex is what makes
short links short, and short links are served by the backend.

Then update:

```bash
# Render → trunc-api
BASE_URL=https://trunc.sh
ALLOWED_ORIGINS=https://app.trunc.sh

# Vercel
VITE_API_URL=https://trunc.sh
VITE_HOSTED_MCP_URL=https://mcp.trunc.sh/mcp
```

Existing links keep working. `shortUrl` is *derived* from `BASE_URL` at read time,
never stored — that was a deliberate choice, and this is the payoff.

---

## Troubleshooting

**Every API call fails with a CORS error.**
`ALLOWED_ORIGINS` on the backend doesn't exactly match your Vercel origin. It must
be the scheme + host with **no trailing slash**: `https://trunc.vercel.app`, not
`https://trunc.vercel.app/`.

**API calls 404 against your Vercel domain.**
`VITE_API_URL` wasn't set at build time. Set it in Vercel → Settings → Environment
Variables, then **redeploy** — Vite bakes it into the bundle.

**Backend boot fails: `Missing required environment variable(s): DATABASE_URL`.**
Exactly what it says. The config validates at boot on purpose, so you find out here
rather than on someone's first request.

**MCP build fails: `Cannot find module 'vitest'` / `Could not find a declaration file for module 'express'`.**
Your build command is missing `--include=dev`. See [Step 2](#step-2--mcp-server-on-render).

**Backend boot fails with an SSL / self-signed certificate error.**
You're using a non-pooled or non-TLS connection string. Make sure it ends with
`?sslmode=require`.

**First request after a while takes ~50 seconds.**
Free-tier cold start. See [the warning above](#2-renders-free-tier-sleeps--and-that-ruins-redirects).

**A short link shows the app's 404 page instead of redirecting.**
You clicked a link on the *Vercel* domain. Short links live on the backend domain —
check what `BASE_URL` is set to on Render.

**MCP tools return `401` / "Not authenticated".**
The JWT expired (30-day TTL) or `JWT_SECRET` changed on the backend. Sign in again
at `/mcp` and copy the new token.

**Everyone got logged out after a deploy.**
You changed `JWT_SECRET`. Every previously-issued token is now invalid. Set it once
and never touch it.
