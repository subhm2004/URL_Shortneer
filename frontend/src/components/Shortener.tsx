"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, shorten } from "@/lib/api";
import type { ShortUrl } from "@/lib/types";
import { useAuth } from "@/context/AuthProvider";
import Pipeline, { type PipelineState } from "./Pipeline";
import ScrambleText from "./ScrambleText";

/**
 * The whole flow, in one component: form → live pipeline → decrypted code →
 * copyable link.
 *
 * The sequence is deliberate. The pipeline stages light up first, the short code
 * scrambles into place as the last one locks, and only then does the finished
 * link slide in. Each beat resolves the one before it.
 */
export default function Shortener() {
  const { isAuthenticated } = useAuth();

  const [longUrl, setLongUrl] = useState("");
  const [state, setState] = useState<PipelineState>("idle");
  const [result, setResult] = useState<ShortUrl | null>(null);
  const [error, setError] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  /** True once the code has finished scrambling — gates the result card. */
  const [codeRevealed, setCodeRevealed] = useState(false);

  /** Bumped per submit; used as Pipeline's key so each run remounts cleanly. */
  const [runId, setRunId] = useState(0);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const onScrambleDone = useCallback(() => setCodeRevealed(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = longUrl.trim();
    if (!url || state === "running") return;

    setRunId((n) => n + 1);
    setState("running");
    setError("");
    setResult(null);
    setCopied(false);
    setCodeRevealed(false);

    const started = performance.now();
    try {
      const { url: created } = await shorten(url);
      setLatencyMs(Math.round(performance.now() - started));
      setResult(created);
      setState("done");
    } catch (err) {
      // The backend's 4xx messages are written for humans — show them verbatim.
      setError(
        err instanceof ApiError ? err.message : "Something went wrong.",
      );
      setState("error");
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
    } catch {
      // The clipboard API rejects on an insecure origin or a denied permission.
      // Bail rather than fall through — claiming "copied" when nothing was
      // written is worse than saying nothing.
      return;
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span
            className="mono pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint select-none"
            aria-hidden="true"
          >
            $
          </span>
          <input
            type="url"
            inputMode="url"
            aria-label="URL to shorten"
            placeholder="https://your-very-long-url.example.com/path?utm_source=…"
            className="input input-prompted mono text-[13.5px]"
            value={longUrl}
            onChange={(e) => {
              setLongUrl(e.target.value);
              if (state === "error") setState("idle");
            }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary sm:w-40"
          disabled={state === "running" || !longUrl.trim()}
        >
          {state === "running" ? (
            <>
              <Spinner /> shortening
            </>
          ) : (
            <>
              Shorten <span className="arrow">→</span>
            </>
          )}
        </button>
      </form>

      {state !== "idle" && (
        <div className="mt-6">
          <Pipeline
            key={runId}
            state={state}
            latencyMs={latencyMs}
            code={result?.urlCode}
            error={error}
          >
            {result && (
              <ScrambleText
                text={`"${result.urlCode}"`}
                className="mono"
                onDone={onScrambleDone}
              />
            )}
          </Pipeline>
        </div>
      )}

      {/* Slides in once the code has finished decrypting. */}
      {result && codeRevealed && (
        <div className="card slide-up mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
          <a
            href={result.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mono flex-1 text-[15px] font-medium break-all text-fg hover:underline"
          >
            {result.shortUrl}
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-secondary btn-sm"
          >
            {copied ? "Copied" : "Copy"}
          </button>

          {!isAuthenticated && (
            <p className="mono w-full text-[11.5px] text-faint">
              This link works without an account.{" "}
              <Link href="/register" className="text-fg-2 underline underline-offset-2 hover:text-fg">
                Create one
              </Link>{" "}
              to track its clicks.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}
