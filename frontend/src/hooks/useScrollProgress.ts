"use client";

import { useEffect, useState } from "react";

/**
 * How far down the page you are (0–1), and whether you've left the top at all.
 *
 * Reads on scroll but writes only inside requestAnimationFrame: a scroll handler
 * that calls setState directly fires dozens of times per frame and forces a
 * layout read on each one. This coalesces them to one update per painted frame.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;

    const read = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;

      setProgress(max > 0 ? Math.min(1, y / max) : 0);
      setScrolled(y > 8);
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(read);
    };

    read(); // a reload can land mid-page; don't wait for a scroll to find out
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { progress, scrolled };
}
