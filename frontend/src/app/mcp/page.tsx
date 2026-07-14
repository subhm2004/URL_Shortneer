"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";

const MCP_URL =
  process.env.NEXT_PUBLIC_MCP_URL ?? "https://trunc-mcp-server.onrender.com/mcp";

const TOOLS = [
  { name: "whoami", desc: "Check whether the server can see your token." },
  { name: "shorten_url", desc: "Shorten a URL. Takes an optional customAlias." },
  { name: "get_my_links", desc: "List the links on your account." },
  { name: "get_clicks_by_day", desc: "Clicks per day, 1–90 days." },
];

export default function McpPage() {
  const { token, isAuthenticated, ready } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const displayToken = token ?? "<sign in to see your token>";

  const config = `{
  "mcpServers": {
    "trunc": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${revealed && token ? token : "<your-jwt>"}"
      }
    }
  }
}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Especially important not to lie here: the user would paste an empty
      // clipboard into their client config and get a baffling 401.
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="grid-bg" aria-hidden="true" />

      <div className="relative mx-auto max-w-[880px] px-5 py-16 sm:px-9">
        <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
          MCP integration
        </p>
        <h1 className="display text-[clamp(2rem,4vw,3rem)] text-fg">
          Connect your AI assistant.
        </h1>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-muted">
          Trunc ships an MCP server. Point Claude Desktop — or any MCP client — at
          it, and you can shorten links and read your analytics from inside a
          conversation.
        </p>

        {/* ---- token ---- */}
        <section className="card-raised mt-12 p-8">
          <h2 className="text-[17px] font-semibold tracking-tight">
            1 · Your token
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            The MCP server has no login of its own. It identifies you by the JWT
            this app issues.
          </p>

          <p
            className="mono mt-5 rounded-lg px-4 py-3 text-[12px] text-danger"
            style={{
              background: "color-mix(in oklab, var(--danger) 10%, transparent)",
              boxShadow: "0 0 0 1px color-mix(in oklab, var(--danger) 30%, transparent)",
            }}
          >
            Treat this like a password. Anyone holding it can create links as you.
          </p>

          {!ready ? (
            <div className="mt-5 h-12 rounded-lg bg-surface-2" />
          ) : isAuthenticated ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <code className="mono min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-4 py-3 text-[12px] text-fg-2 shadow-[var(--ring)]">
                {revealed ? displayToken : "•".repeat(48)}
              </code>
              <button
                onClick={() => setRevealed((r) => !r)}
                className="btn btn-secondary btn-sm"
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
              <button
                onClick={() => token && copy(token, "token")}
                className="btn btn-primary btn-sm"
                disabled={!token}
              >
                {copied === "token" ? "Copied" : "Copy"}
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn btn-primary btn-sm">
                Sign in to get your token
              </Link>
              <Link href="/register" className="btn btn-secondary btn-sm">
                Create an account
              </Link>
            </div>
          )}
        </section>

        {/* ---- config ---- */}
        <section className="card-raised mt-6 p-8">
          <h2 className="text-[17px] font-semibold tracking-tight">
            2 · Claude Desktop config
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            Paste this into{" "}
            <code className="mono rounded bg-surface-2 px-1.5 py-0.5 text-[12.5px]">
              claude_desktop_config.json
            </code>
            , then quit Claude Desktop completely and reopen it.
          </p>

          <div className="terminal mt-5">
            <div className="terminal-head">
              <span className="mono text-[11.5px] text-faint">
                claude_desktop_config.json
              </span>
              <button
                onClick={() => copy(config, "config")}
                className="btn btn-ghost btn-sm"
              >
                {copied === "config" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mono overflow-x-auto p-5 text-[12.5px] leading-relaxed text-fg-2">
              <code>{config}</code>
            </pre>
          </div>
        </section>

        {/* ---- tools ---- */}
        <section className="card-raised mt-6 p-8">
          <h2 className="text-[17px] font-semibold tracking-tight">
            3 · What you can ask for
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            Four tools. Every one of them requires your token.
          </p>

          <ul className="mt-6 divide-y divide-border-soft">
            {TOOLS.map((tool) => (
              <li
                key={tool.name}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
              >
                <code className="mono text-[13px] text-matrix">{tool.name}</code>
                <span className="text-[13.5px] text-muted">{tool.desc}</span>
              </li>
            ))}
          </ul>

          <p className="mt-7 rounded-lg bg-surface-2 px-4 py-3 text-[13.5px] text-muted">
            Then just ask:{" "}
            <span className="text-fg-2">
              &ldquo;shorten github.com/subhm2004 for me and tell me how my links
              did this week&rdquo;
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
