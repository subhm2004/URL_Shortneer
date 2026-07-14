import type { NextConfig } from "next";

/**
 * Where THIS SERVER forwards /api to. Server-only — deliberately not prefixed
 * with NEXT_PUBLIC_, because the browser must never use it directly.
 *
 * This is the counterpart to NEXT_PUBLIC_API_URL, and the two must not be
 * confused:
 *
 *   BACKEND_ORIGIN       the rewrite target. Next (the server) calls this.
 *   NEXT_PUBLIC_API_URL  what the BROWSER prefixes onto every request.
 *
 * In development NEXT_PUBLIC_API_URL is left unset, so the browser fetches the
 * relative path /api/… — same-origin — and Next quietly forwards it here. No
 * CORS, no preflight, nothing to configure.
 *
 * In production the frontend is on Vercel and the API on Render: genuinely
 * different origins. There NEXT_PUBLIC_API_URL is set to the Render URL and the
 * browser calls it directly, with that origin in the backend's ALLOWED_ORIGINS.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:5050";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Emits .next/standalone — a self-contained server carrying only the
  // node_modules it actually imports, which is what lets the Docker image copy a
  // handful of files instead of the whole dependency tree.
  output: "standalone",

  async rewrites() {
    /**
     * Returning a plain array puts these in the `afterFiles` phase, which runs
     * AFTER Next's own filesystem routes. That is what lets /api/chat — a real
     * route handler in this app — win, while every other /api/* path falls
     * through to the Express backend.
     *
     * Worth knowing, because the failure is silent: move these into `beforeFiles`
     * and the chat route stops existing, its requests get proxied to Express, and
     * you get a 404 from a server that was never meant to answer them.
     */
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
      {
        /**
         * The backend's health check lives at /health, outside /api — so it was
         * not covered by the rule above, and the footer's status indicator got a
         * 404 from Next and reported the API as unreachable while it was serving
         * requests perfectly well.
         *
         * A status light that is red when everything is fine is worse than no
         * status light: it trains you to ignore it, and then it's useless on the
         * day it's telling the truth.
         */
        source: "/health",
        destination: `${BACKEND_ORIGIN}/health`,
      },
    ];
  },
};

export default nextConfig;
