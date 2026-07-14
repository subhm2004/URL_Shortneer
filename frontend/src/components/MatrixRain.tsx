"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ<>{}[]/\\|=+-*#$%&";

/**
 * Matrix rain, behind the terminal body.
 *
 * Canvas rather than DOM: this repaints ~14 times a second and a DOM version
 * would be hundreds of elements thrashing style recalculation for pure
 * decoration.
 *
 * Deliberately dim. It's texture, not content — the moment it competes with the
 * log lines for attention it has failed at its only job, and the log lines are
 * the part that's actually true.
 */
export default function MatrixRain({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // A viewer who asked for less motion gets no rain at all, rather than a
    // slower one — the point of the setting is stillness.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const FONT = 12;
    let columns: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      // Draw at device resolution but lay out in CSS pixels, or the glyphs are a
      // blurry mess on a retina screen.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = parent.getBoundingClientRect();

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      const count = Math.ceil(width / FONT);
      columns = Array.from({ length: count }, () =>
        Math.floor((Math.random() * height) / FONT),
      );
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);

      // ~14fps. Rain that runs at 60 looks like static; the stutter is what makes
      // it read as falling characters.
      if (now - last < 70) return;
      last = now;

      const { width, height } = canvas.getBoundingClientRect();

      // Fade the previous frame instead of clearing it — that trailing smear is
      // the whole effect.
      ctx.fillStyle = "rgba(13, 13, 13, 0.14)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${FONT}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = "rgba(55, 247, 18, 0.5)";

      columns.forEach((y, i) => {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillText(glyph, i * FONT, y * FONT);

        // Reset the column near the bottom, at random, so they don't march in
        // lockstep.
        columns[i] = y * FONT > height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };

    resize();
    raf = requestAnimationFrame(draw);

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={`pointer-events-none absolute inset-0 opacity-[0.07] ${className}`}
      aria-hidden="true"
    />
  );
}
