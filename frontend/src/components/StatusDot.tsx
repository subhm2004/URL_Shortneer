"use client";

import { useEffect, useState } from "react";

type Health = "checking" | "up" | "down";

/**
 * A live status indicator that actually checks.
 *
 * Every footer has a green "All systems operational" dot; almost none of them are
 * wired to anything. This one pings /health. If the backend is down it says so —
 * which is the only thing that makes the green dot mean anything on the days it
 * *is* green.
 */
export default function StatusDot() {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? ""}/health`,
          { cache: "no-store" },
        );
        if (!cancelled) setHealth(res.ok ? "up" : "down");
      } catch {
        if (!cancelled) setHealth("down");
      }
    };

    check();
    // Slow poll. This is a footer ornament, not a monitoring system — hammering
    // the API from every open tab would cost more than it tells anyone.
    const id = setInterval(check, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const label =
    health === "up"
      ? "All systems operational"
      : health === "down"
        ? "API unreachable"
        : "Checking…";

  const color =
    health === "up"
      ? "var(--success)"
      : health === "down"
        ? "var(--danger)"
        : "var(--faint)";

  return (
    <span className="flex items-center gap-2.5 text-[12.5px] text-muted">
      <span
        className="h-2 w-2 flex-none rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 0 3px color-mix(in oklab, ${color} 16%, transparent)`,
          animation: health === "up" ? "pulse 2.2s var(--ease) infinite" : "none",
        }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
