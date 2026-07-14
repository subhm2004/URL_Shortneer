"use client";

import { useEffect, useState } from "react";

/**
 * Types text out character by character, the way a terminal actually prints.
 *
 * The text is real — this reveals it, it doesn't invent it. That distinction is
 * the whole reason the pipeline is worth looking at: the moment it starts
 * printing plausible-looking nonsense to seem busy, nothing else on it can be
 * trusted either.
 */
export default function TypeText({
  text,
  speed = 16,
  startDelay = 0,
  className = "",
  onDone,
}: {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  startDelay?: number;
  className?: string;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(text.length);
      onDone?.();
      return;
    }

    setShown(0);

    let i = 0;
    let interval: ReturnType<typeof setInterval>;

    const begin = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= text.length) {
          clearInterval(interval);
          onDone?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(begin);
      clearInterval(interval);
    };
    // onDone is intentionally not a dependency: a parent that re-creates the
    // callback each render would otherwise restart the typing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  return (
    <span className={className}>
      {text.slice(0, shown)}
      {shown < text.length && <span className="type-caret" aria-hidden="true" />}
    </span>
  );
}
