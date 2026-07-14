import { useEffect, useState } from "react";

/**
 * The landing page's centrepiece: as a real /api/shorten request runs, the
 * stages it passes through light up one by one.
 *
 * Honesty rule for this component — the only number we print that claims to be
 * measured is `latencyMs`, which is the real round-trip the caller timed. The
 * per-stage ticks are ordering, not timings: the server doesn't report per-stage
 * durations, so we don't invent any.
 */

const STAGES = [
  {
    id: "validate",
    layer: "Chain of Responsibility",
    call: "UrlValidator.validate()",
    detail: "Required → MaxLength → Parsable → Protocol → PublicHost → NoSelfRef",
  },
  {
    id: "generate",
    layer: "Strategy + Factory",
    call: "ShortCodeStrategy.generate()",
    detail: "NanoIdStrategy · 56-char alphabet · length 8",
  },
  {
    id: "persist",
    layer: "Repository + Decorator",
    call: "UrlRepository.create()",
    detail: "INSERT INTO urls · unique(url_code) arbitrates collisions",
  },
  {
    id: "publish",
    layer: "Observer",
    call: "EventBus.publish(link.created)",
    detail: "2 subscribers · runs after the response is sent",
  },
];

const STAGE_MS = 260;

export default function Pipeline({ state, latencyMs, code, error }) {
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (state === "idle") {
      setLit(0);
      return;
    }

    if (state === "error") {
      // Validation is the only stage that can reject, so light it red and stop.
      setLit(1);
      return;
    }

    if (state !== "done") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(STAGES.length);
      return;
    }

    setLit(0);
    const timers = STAGES.map((_, i) =>
      setTimeout(() => setLit(i + 1), (i + 1) * STAGE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  if (state === "idle") return null;

  return (
    <div className="pipeline" role="status" aria-live="polite">
      <div className="pipeline-head">
        <span className="pipeline-cmd">
          <span className="prompt">$</span> POST /api/shorten
        </span>
        {state === "done" && latencyMs != null && (
          <span className="pipeline-latency">{latencyMs}ms round-trip</span>
        )}
        {state === "loading" && <span className="pipeline-latency">running…</span>}
      </div>

      <ol className="pipeline-stages">
        {STAGES.map((stage, i) => {
          const failed = state === "error" && i === 0;
          const done = !failed && i < lit;
          const active = !failed && i === lit && state !== "done";
          const skipped = state === "error" && i > 0;

          return (
            <li
              key={stage.id}
              className={[
                "pipeline-stage",
                done && "is-done",
                active && "is-active",
                failed && "is-failed",
                skipped && "is-skipped",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="stage-mark" aria-hidden="true">
                {failed ? "✕" : done ? "✓" : active ? "⟳" : "·"}
              </span>

              <span className="stage-body">
                <span className="stage-call">{stage.call}</span>
                <span className="stage-layer">{stage.layer}</span>
                <span className="stage-detail">
                  {failed ? error : stage.detail}
                </span>
              </span>

              {stage.id === "publish" && done && (
                <span className="stage-async">async</span>
              )}
            </li>
          );
        })}
      </ol>

      {state === "done" && code && (
        <div className="pipeline-out">
          <span className="prompt">→</span> url_code ={" "}
          <span className="pipeline-code">"{code}"</span>
        </div>
      )}
    </div>
  );
}
