"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { tokenStore } from "@/lib/tokenStore";

interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  result: string;
  ms: number;
  failed: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Only on assistant turns: what it actually called to get there. */
  tools?: ToolTrace[];
}

const SUGGESTIONS = [
  "Shorten https://github.com/subhm2004/URL_Shortneer",
  "How many links do I have, and which is the most clicked?",
  "Show my clicks over the last 7 days",
];

export default function ChatPage() {
  const { isAuthenticated, ready } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // The tools act on this user's account, so the route needs their JWT.
          Authorization: `Bearer ${tokenStore.get() ?? ""}`,
        },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "The assistant couldn't answer.");
        return;
      }

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply, tools: data.toolCalls ?? [] },
      ]);
    } catch {
      setError("Couldn't reach the assistant.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-[70dvh] place-items-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-fg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-[70dvh] place-items-center px-5">
        <div className="card max-w-[440px] p-9 text-center">
          <h1 className="display text-[22px]">Sign in to use the assistant</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            The tools act on your own links and your own click data, so the
            assistant needs to know who you are.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-secondary">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[860px] flex-col px-5 sm:px-9">
      <div className="grid-bg" aria-hidden="true" />

      <header className="relative pt-12 pb-8">
        <p className="mono mb-3 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
          MCP · live
        </p>
        <h1 className="display text-[clamp(1.8rem,3.6vw,2.5rem)]">
          Ask it about your links.
        </h1>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted">
          This is a real MCP client. It calls the same four tools Claude Desktop
          would — on the same server, over the same protocol. And it shows you
          every call it makes.
        </p>
      </header>

      <div className="relative flex-1 space-y-6 pb-6">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-lg bg-surface px-3.5 py-2 text-left text-[13px] text-muted shadow-[var(--ring)] transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-xl rounded-br-sm bg-surface-2 px-4 py-2.5 text-[14.5px]">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              {m.tools?.map((tool, j) => (
                <ToolCallRow key={j} tool={tool} />
              ))}
              <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap text-fg-2">
                {m.content}
              </p>
            </div>
          ),
        )}

        {busy && (
          <div className="mono flex items-center gap-2.5 text-[13px] text-muted">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-border border-t-matrix" />
            thinking…
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg px-4 py-3 text-[13.5px] text-danger"
            style={{
              background: "color-mix(in oklab, var(--danger) 10%, transparent)",
              boxShadow: "0 0 0 1px color-mix(in oklab, var(--danger) 35%, transparent)",
            }}
          >
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 flex gap-3 bg-bg/80 py-5 backdrop-blur-xl"
      >
        <input
          className="input flex-1"
          placeholder="Shorten a link, or ask how yours are doing…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          aria-label="Message the assistant"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

/**
 * The point of the whole page: the tool call is shown, not hidden.
 *
 * Most chat UIs bury this — you get an answer and no way to tell whether the
 * model looked anything up or simply made it up. Here the arguments, the raw
 * result, and the latency are all on screen, so you can see exactly what the
 * model asked for and exactly what came back.
 */
function ToolCallRow({ tool }: { tool: ToolTrace }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="terminal">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <span
          className={`mono text-[13px] ${tool.failed ? "text-danger" : "text-matrix"}`}
          aria-hidden="true"
        >
          {tool.failed ? "✕" : "✓"}
        </span>

        <span className="mono flex-1 text-[13px] text-fg">{tool.name}</span>

        <span className="mono text-[11px] tabular-nums text-faint">{tool.ms}ms</span>

        <span className="mono text-[11px] text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mono space-y-3 border-t border-border-soft px-5 py-4 text-[12px]">
          <div>
            <p className="mb-1 text-[10px] tracking-[0.12em] text-faint uppercase">
              arguments
            </p>
            <pre className="overflow-x-auto text-fg-2">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-[10px] tracking-[0.12em] text-faint uppercase">
              result
            </p>
            <pre
              className={`overflow-x-auto whitespace-pre-wrap ${tool.failed ? "text-danger" : "text-matrix"}`}
            >
              {tool.result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
