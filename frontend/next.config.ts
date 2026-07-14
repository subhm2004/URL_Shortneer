import type { NextConfig } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Emits .next/standalone — a self-contained server with only the node_modules
  // it actually imports. That is what lets the Docker image copy a handful of
  // files instead of the whole dependency tree.
  output: "standalone",

  async rewrites() {
    // In development the browser talks to Next on :3000 and the API lives on
    // :5050 — a cross-origin request that would need CORS on every call. Proxying
    // /api through Next makes it same-origin, so the browser never sees a
    // preflight and the app works with the backend's CORS list untouched.
    //
    // In production the frontend is on Vercel and the API is on Render, which are
    // genuinely different origins; there NEXT_PUBLIC_API_URL is set and the client
    // calls the backend directly (the backend allows the Vercel origin).
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
