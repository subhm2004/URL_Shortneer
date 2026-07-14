"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The decrypt effect: every character cycles through random glyphs before
 * locking into place, left to right.
 *
 * It is not decoration for its own sake. The short code is the one thing the
 * user is waiting for, and it arrives in a single network response — there is no
 * progress to show. Scrambling it into place gives that instant a shape, and it
 * lands at the same moment the pipeline above finishes. The animation *is* the
 * feedback.
 */

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#$%&*<>/\\[]{}=+-_";

/** Stagger between characters locking in. */
const LOCK_STAGGER_MS = 55;
/** How long a character flickers before it settles. */
const FLICKER_MS = 420;
/** Glyphs swap on this beat. At 60fps every frame would be a strobe. */
const GLYPH_SWAP_MS = 45;

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

interface Cell {
  char: string;
  settled: boolean;
}

interface Props {
  text: string;
  className?: string;
  /** Fires once every character has locked in. */
  onDone?: () => void;
}

export default function ScrambleText({ text, className = "", onDone }: Props) {
  const [cells, setCells] = useState<Cell[]>(() =>
    text.split("").map((char) => ({ char, settled: true })),
  );
  const [flashing, setFlashing] = useState(false);

  // Held in a ref so a changing callback identity can't restart the animation.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const chars = text.split("");

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || chars.length === 0) {
      setCells(chars.map((char) => ({ char, settled: true })));
      onDoneRef.current?.();
      return;
    }

    const start = performance.now();
    let raf = 0;
    let lastSwap = 0;
    let lastLocked = -1;

    const tick = (now: number) => {
      const elapsed = now - start;

      // How many characters have locked in by now.
      const locked = Math.floor((elapsed - FLICKER_MS) / LOCK_STAGGER_MS) + 1;
      const swap = elapsed - lastSwap >= GLYPH_SWAP_MS;

      // Repaint only when something actually changed — a new character locked,
      // or the glyphs are due to swap. Otherwise we'd setState 60 times a second
      // to render an identical frame.
      if (locked !== lastLocked || swap) {
        if (swap) lastSwap = elapsed;
        lastLocked = locked;

        setCells(
          chars.map((char, i) =>
            i < locked
              ? { char, settled: true }
              : { char: randomGlyph(), settled: false },
          ),
        );
      }

      if (locked < chars.length) {
        raf = requestAnimationFrame(tick);
      } else {
        setFlashing(true);
        onDoneRef.current?.();
      }
    };

    setFlashing(false);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return (
    <span
      className={`${className} ${flashing ? "resolve-flash" : ""}`}
      // The animated glyphs are noise to a screen reader; announce the real value.
      aria-label={text}
      role="text"
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          className="scramble-char"
          data-settled={cell.settled}
          aria-hidden="true"
        >
          {cell.char}
        </span>
      ))}
    </span>
  );
}
