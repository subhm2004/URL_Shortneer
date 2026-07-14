# trunc-mcp

An MCP (Model Context Protocol) server for the Trunc URL shortener. Two transports:

- **stdio** — local process, use with Claude Desktop on your own machine
- **HTTP (Streamable)** — deploy to a host (e.g. Render), share with anyone

Both transports share the same tool definitions, so the API surface is identical.

> **Migrating from 0.2.x?** The `register_user` and `login` tools have been removed. Get a JWT from the Trunc web app and configure your MCP client to send it (see [Getting a token](#getting-a-token)).

## Prerequisites

- Node.js 18+
- The Express backend (`../app`) running, either locally or deployed
- A JWT from the Trunc web app — see [Getting a token](#getting-a-token)

## Install

```bash
cd mcp-server
npm install
cp .env.example .env
# edit .env: set SHORTENER_API_BASE to your backend, paste your JWT into TRUNC_MCP_TOKEN
```

## Run

### stdio (local dev)

```bash
npm run dev
```

### HTTP (local dev)

```bash
npm run dev:http
# listening on http://localhost:3001/mcp
# health check at http://localhost:3001/health
```

### Built

```bash
npm run build
npm run start:stdio   # local stdio
npm run start:http    # local HTTP
```

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `SHORTENER_API_BASE` | `http://localhost:5000` | Base URL of the Express backend. Set in `.env` locally, in Render's dashboard for production. |
| `PORT` | `3001` | HTTP listen port. Ignored by the stdio transport. Render sets this automatically. |
| `TRUNC_MCP_TOKEN` | — | **Required for stdio.** The JWT issued by the web app. Ignored by the HTTP transport, which reads the token per-request from the `Authorization` header. |

## Tools

| Tool | Auth | Description |
|------|------|-------------|
| `whoami` | — | Show whether a JWT is currently visible to the MCP server |
| `shorten_url` | required | Shorten a long URL; attaches the new link to your account |
| `get_my_links` | required | List the authenticated user's links |
| `get_clicks_by_day` | required | Get click counts aggregated per day over the last N days (1-90, default 30) |

## Auth model

All tools require a JWT. The MCP server does **not** issue tokens — obtain one from the Trunc web app, then configure your client to send it.

This matches the auth model of the dashboard: every meaningful operation is attributed to an account, and there are no anonymous links that no one can manage later.

## How auth works

**stdio:** set `TRUNC_MCP_TOKEN` in your MCP client config's `env` block. The MCP server reads it on every request. To rotate, update the env var and restart the client.

**HTTP (hosted):** every request must carry `Authorization: Bearer <jwt>`. The MCP server extracts the token per-request via an `AsyncLocalStorage` — there is no server-side session state. The server is fully stateless and horizontally scalable.

Per-request `Authorization` headers always take precedence over `TRUNC_MCP_TOKEN`, but the two never run together in practice: stdio processes never see HTTP requests, and HTTP requests are never routed through the stdio transport.

## Getting a token

1. Sign in at `https://your-site.com/login` (or register at `/register`).
2. Navigate to `/mcp` in the web app.
3. Click **generate** to reveal your JWT, then **copy**.
4. Paste the JWT into your MCP client config:
   - **HTTP**: under `headers.Authorization` as `Bearer <token>`
   - **stdio**: into the `env.TRUNC_MCP_TOKEN` field

## Use with Claude Desktop

### stdio (local)

```json
{
  "mcpServers": {
    "trunc": {
      "command": "npx",
      "args": ["tsx", "C:/path/to/url_shortner/mcp-server/src/index.ts"],
      "env": {
        "SHORTENER_API_BASE": "http://localhost:5000",
        "TRUNC_MCP_TOKEN": "<paste-jwt-here>"
      }
    }
  }
}
```

### HTTP (hosted)

```json
{
  "mcpServers": {
    "trunc": {
      "url": "https://trunc-mcp.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer <paste-jwt-here>"
      }
    }
  }
}
```

## Deploy to Render

1. Push the repo to GitHub
2. In Render: **New** → **Web Service** → connect the repo
3. Set **Root Directory** to `mcp-server`
4. Render auto-detects the Node build. Override the start command to:

   ```
   npm run start:http
   ```

5. Add env vars in the Render dashboard:

   | Key | Value |
   |---|---|
   | `SHORTENER_API_BASE` | `https://your-backend.onrender.com` |
   | `PORT` | `10000` (Render's default; the code reads it automatically) |

   The MCP server is stateless — it does not need a token in its own env. Tokens arrive per-request from the `Authorization` header.

6. Add a **Health Check Path** of `/health` so Render keeps the service alive
7. After first deploy, hit `https://trunc-mcp.onrender.com/health` to confirm

> Free Render services sleep after 15 minutes of inactivity, so the first MCP call after idle takes ~30s for cold start. Upgrade to a paid plan or move to Fly.io/Railway for always-on.

## Use with MCP Inspector

```bash
# stdio — set TRUNC_MCP_TOKEN in your shell first
export TRUNC_MCP_TOKEN=<paste-jwt-here>
npx @anthropic-ai/mcp-inspector npx tsx src/index.ts

# HTTP (server must be running)
npx @anthropic-ai/mcp-inspector http://localhost:3001/mcp
```

When using the Inspector against the HTTP transport, set the `Authorization` header in the Inspector's request config to `Bearer <jwt>`.
