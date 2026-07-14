"use client";

import { useEffect, useState } from "react";
import MatrixRain from "./MatrixRain";
import TypeText from "./TypeText";

/**
 * The terminal. As a real POST /api/shorten runs, the work it does prints itself
 * out, line by line, the way a machine reports in.
 *
 * One rule governs every pixel: **nothing here is invented.** No fake hex
 * addresses, no fabricated per-stage timings, no "0x7fff… allocated" to look
 * busy. Every check listed is a check the server genuinely performs, and
 * `latencyMs` is the round-trip the caller actually measured. The server doesn't
 * report per-stage durations, so none are shown.
 *
 * The typing, the scanlines, the rain — those are how it's *revealed*, not what
 * is claimed. That line matters: the moment this prints plausible nonsense to
 * look impressive, nothing else on it can be believed either.
 */

export type PipelineState = "idle" | "running" | "done" | "error";

/** The request never left the browser — no stage of it ever ran. */
export const NETWORK_FAILURE = -1;

const STAGES = [
  {
    id: "validate",
    op: "validating target url",
    steps: ["protocol allowlist", "public host", "max length", "self-reference"],
  },
  {
    id: "generate",
    op: "minting short code",
    steps: ["56-char alphabet", "8 characters", "collision retry armed"],
  },
  {
    id: "persist",
    op: "writing to postgres",
    steps: ["INSERT INTO urls", "unique(url_code)"],
  },
  {
    id: "publish",
    op: "dispatching event",
    steps: ["link.created", "2 subscribers"],
    async: true,
  },
] as const;

/** How long each stage waits before it starts printing. */
const STAGE_MS = 460;

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  state: PipelineState;
  latencyMs?: number | null;
  code?: string | null;
  error?: string;
  /** Index of the stage that rejected, or NETWORK_FAILURE. */
  failedStage?: number;
  children?: React.ReactNode;
}

export default function Pipeline({
  state,
  latencyMs,
  code,
  error,
  failedStage = 0,
  children,
}: Props) {
  /**
   * Only the successful run animates, so only it needs state. The initial value
   * comes from a lazy initialiser rather than an effect: a reduced-motion viewer
   * starts fully revealed and never sees a timer.
   *
   * The parent remounts this via `key` on each request, and that is what resets
   * the reveal — setting state synchronously inside an effect would schedule a
   * second render pass on every state change.
   */
  const [revealed, setRevealed] = useState(() =>
    prefersReduced() ? STAGES.length : 0,
  );

  useEffect(() => {
    if (state !== "done" || prefersReduced()) return;

    const timers = STAGES.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), i * STAGE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  if (state === "idle") return null;

  const networkFailed = state === "error" && failedStage === NETWORK_FAILURE;
  const live = state === "running" || (state === "done" && revealed < STAGES.length);
  const lit = state === "error" ? failedStage : state === "done" ? revealed : 0;

  return (
    <div
      className={`terminal ${live ? "terminal-live" : ""}`}
      role="status"
      aria-live="polite"
    >
      <MatrixRain />

      {/* ---- chrome ---- */}
      <div className="term-chrome">
        <span className="term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title">trunc://shorten</span>
        <span className="term-meta">
          {state === "running" ? (
            <span className="text-matrix">
              executing<Dots />
            </span>
          ) : networkFailed ? (
            "no response"
          ) : state === "error" ? (
            <span className="text-danger">rejected</span>
          ) : latencyMs != null ? (
            `${latencyMs}ms`
          ) : null}
        </span>
      </div>

      {/* ---- body ---- */}
      <div className="term-body">
        <p className="term-cmd">
          <span className="prompt">&gt;</span> POST /api/shorten
        </p>

        {/* The request never left. Naming a stage here would be a lie — none ran. */}
        {networkFailed && (
          <div className="glitch-in mt-4">
            <p className="term-op text-danger">
              <span className="term-idx">[----]</span> ✕ request never reached the
              server
            </p>
            <LogRow label={error ?? "no response"} status="FAIL" failed />
          </div>
        )}

        <ol className={networkFailed ? "opacity-20" : ""}>
          {STAGES.map((stage, i) => {
            const failed = state === "error" && !networkFailed && i === failedStage;
            const done = !failed && i < lit;
            const active = !failed && i === lit && state !== "done";
            const skipped = state === "error" && (networkFailed || i > failedStage);

            return (
              <li
                key={stage.id}
                className={[
                  "term-stage",
                  done && "glitch-in",
                  failed && "glitch-in",
                  !done && !failed && !active && "opacity-25",
                  skipped && "opacity-[0.12]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p
                  className={`term-op ${failed ? "text-danger" : done ? "text-fg" : "text-faint"}`}
                >
                  <span className="term-idx">
                    [{String(i + 1).padStart(4, "0")}]
                  </span>{" "}
                  <span className={failed ? "text-danger" : "prompt"}>
                    {failed ? "✕" : active ? "▸" : "▸"}
                  </span>{" "}
                  {done || failed ? (
                    <TypeText text={stage.op} speed={13} />
                  ) : (
                    stage.op
                  )}
                  {active && <span className="type-caret" aria-hidden="true" />}
                </p>

                {/* On a rejection the sub-steps are replaced by the reason.
                    Printing "protocol [ OK ]" next to a red ✕ would be a flat lie. */}
                {failed ? (
                  <LogRow label={error ?? "rejected"} status="FAIL" failed />
                ) : (
                  stage.steps.map((step) => (
                    <LogRow
                      key={step}
                      label={step}
                      status={
                        done
                          ? "async" in stage && stage.async
                            ? "ASYNC"
                            : "OK"
                          : "····"
                      }
                      pending={!done}
                    />
                  ))
                )}
              </li>
            );
          })}
        </ol>

        {/* Gated on the last stage having landed, not merely on `done`. The code
            is the payoff — it should arrive after the log, not race it. */}
        {state === "done" && code && lit >= STAGES.length && (
          <p className="term-out">
            <span className="prompt">&gt;&gt;</span> url_code resolved{" "}
            {children}
            <span className="type-caret" aria-hidden="true" />
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A log line with leader dots and a status bracket — the shape of every boot
 * sequence and init script ever written, which is exactly why it reads as one.
 */
function LogRow({
  label,
  status,
  failed = false,
  pending = false,
}: {
  label: string;
  status: string;
  failed?: boolean;
  pending?: boolean;
}) {
  return (
    <p className="log-row">
      <span
        className={`log-label ${failed ? "text-danger" : pending ? "text-faint" : "text-fg-2"}`}
      >
        {label}
      </span>
      <span className="log-dots" aria-hidden="true" />
      <span
        className={`log-status ${
          failed ? "text-danger" : pending ? "text-faint" : "text-matrix"
        }`}
      >
        [ {status} ]
      </span>
    </p>
  );
}

/** Three dots that cycle while the request is in flight. */
function Dots() {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (prefersReduced()) return;
    const id = setInterval(() => setN((v) => (v + 1) % 4), 320);
    return () => clearInterval(id);
  }, []);

  return <span className="inline-block w-4 text-left">{".".repeat(n)}</span>;
}

export { STAGES };
