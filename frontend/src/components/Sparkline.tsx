"use client";

import { useId } from "react";
import type { DayCount } from "@/lib/types";

/**
 * Clicks per day, drawn as an area chart in plain SVG.
 *
 * No charting library. This draws one line and one filled area — importing a
 * library for that would ship more bytes than the entire page.
 */
export default function Sparkline({
  data,
  height = 220,
}: {
  data: DayCount[];
  height?: number;
}) {
  const gradientId = useId();

  if (data.length === 0) return null;

  const W = 1000;
  const H = height;
  const PAD_Y = 16;

  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? W / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = PAD_Y + (1 - d.count / max) * (H - PAD_Y * 2);
    return { x, y, ...d };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const first = data[0]?.date;
  const last = data.at(-1)?.date;

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="mono text-[11px] tracking-[0.14em] text-faint uppercase">
            Clicks · last {data.length} days
          </p>
          <p className="mono mt-1.5 text-[26px] leading-none font-medium tabular-nums text-fg">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[220px] w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${total} clicks across the last ${data.length} days`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--matrix)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--matrix)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--matrix)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          // preserveAspectRatio="none" stretches the viewBox, which would also
          // stretch the stroke. This keeps it an even 2px at any width.
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mono mt-4 flex justify-between text-[11px] text-faint">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
