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

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Pipeline({ state, latencyMs, code, error }) {
  /**
   * Only the successful run animates, so only it needs state. The initial value
   * comes from a lazy initialiser rather than an effect — a reduced-motion
   * viewer starts fully revealed and never sees a timer.
   *
   * The parent remounts this component (via `key`) on each new request, which is
   * what resets the reveal. That's deliberate: setting state synchronously inside
   * the effect — which is what this did before — schedules a second render pass
   * on every single state change, and React's compiler lint flags it for exactly
   * that reason.
   */
  const [revealed, setRevealed] = useState(() =>
    prefersReducedMotion() ? STAGES.length : 0,
  );

  useEffect(() => {
    if (state !== "done" || prefersReducedMotion()) return;

    const timers = STAGES.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * STAGE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  // Derived, not stored. Validation is the only stage that can reject, so an
  // error lights the first one red and stops there.
  const lit = state === "error" ? 1 : state === "done" ? revealed : 0;

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
