"use client";

import { useEffect, useState } from "react";

/**
 * The centrepiece: as a real POST /api/shorten runs, the layers it passes
 * through light up in order.
 *
 * One honesty rule governs this component — the only measured number it prints
 * is `latencyMs`, the round-trip the caller actually timed. The server does not
 * report per-stage durations, so we do not invent any. The ticks are ordering,
 * not timings.
 */

export type PipelineState = "idle" | "running" | "done" | "error";

const STAGES = [
  {
    id: "validate",
    call: "UrlValidator.validate()",
    layer: "Chain of Responsibility",
    detail: "Required → MaxLength → Parsable → Protocol → PublicHost → NoSelfRef",
  },
  {
    id: "generate",
    call: "ShortCodeStrategy.generate()",
    layer: "Strategy + Factory",
    detail: "NanoIdStrategy · 56-char alphabet · length 8",
  },
  {
    id: "persist",
    call: "UrlRepository.create()",
    layer: "Repository + Decorator",
    detail: "INSERT INTO urls · unique(url_code) arbitrates collisions",
  },
  {
    id: "publish",
    call: "EventBus.publish(link.created)",
    layer: "Observer",
    detail: "2 subscribers · runs after the response is sent",
    async: true,
  },
] as const;

const STAGE_MS = 260;

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  state: PipelineState;
  latencyMs?: number | null;
  code?: string | null;
  error?: string;
  /** Rendered under the result line — the short URL, the copy button, etc. */
  children?: React.ReactNode;
}

export default function Pipeline({ state, latencyMs, code, error, children }: Props) {
  /**
   * Only the successful run animates, so only it needs state. The initial value
   * comes from a lazy initialiser rather than an effect: a reduced-motion viewer
   * starts fully revealed and never sees a timer.
   *
   * The parent remounts this via `key` on each new request, and that is what
   * resets the reveal — setting state synchronously inside the effect would
   * schedule a second render pass on every state change.
   */
  const [revealed, setRevealed] = useState(() =>
    prefersReduced() ? STAGES.length : 0,
  );

  useEffect(() => {
    if (state !== "done" || prefersReduced()) return;

    const timers = STAGES.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * STAGE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  if (state === "idle") return null;

  // Derived, not stored. Validation is the only stage that can reject, so an
  // error lights the first one red and everything after it is never reached.
  const lit = state === "error" ? 1 : state === "done" ? revealed : 0;

  return (
    <div className="terminal" role="status" aria-live="polite">
      <div className="terminal-head">
        <span className="text-fg-2">
          <span className="prompt mr-2">$</span>
          POST /api/shorten
        </span>
        <span className="text-[11px] tabular-nums text-faint">
          {state === "running"
            ? "running…"
            : state === "error"
              ? "rejected"
              : latencyMs != null
                ? `${latencyMs}ms round-trip`
                : null}
        </span>
      </div>

      <ol className="terminal-body">
        {STAGES.map((stage, i) => {
          const failed = state === "error" && i === 0;
          const done = !failed && i < lit;
          const active = !failed && i === lit && state !== "done";
          const skipped = state === "error" && i > 0;

          const cls = [
            "stage",
            done && "stage-done",
            active && "stage-active",
            failed && "stage-failed",
            skipped && "stage-skipped",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={stage.id} className={cls}>
              <span className="stage-mark" aria-hidden="true">
                {failed ? "✕" : done ? "✓" : active ? "⟳" : "·"}
              </span>

              <span className="flex min-w-0 flex-col">
                <span className="stage-call">{stage.call}</span>
                <span className="stage-layer">{stage.layer}</span>
                <span className="stage-detail">
                  {failed ? error : stage.detail}
                </span>
              </span>

              {"async" in stage && stage.async && done && (
                <span className="async-pill">async</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Gated on the last stage having lit, not merely on `done`. The code is the
          payoff — it should land after the pipeline finishes, not race it. */}
      {state === "done" && code && lit >= STAGES.length && (
        <div className="border-t border-border-soft px-5 py-4 text-[13px]">
          <span className="prompt mr-2">→</span>
          <span className="text-faint">url_code = </span>
          {children}
        </div>
      )}
    </div>
  );
}

export { STAGES };
