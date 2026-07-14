"use client";

import { useId, useState } from "react";
import type { DayCount } from "@/lib/types";

const RANGES = [7, 30, 90];

/**
 * Clicks per day, drawn as an area chart in plain SVG.
 *
 * No charting library. This is one line and one filled area — importing a chart
 * package for that would ship more bytes than the rest of the page put together.
 */
export default function Sparkline({
  data,
  range,
  onRangeChange,
}: {
  data: DayCount[];
  range: number;
  onRangeChange: (days: number) => void;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return null;

  const W = 1000;
  const H = 200;
  const PAD = 14;

  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? W / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: PAD + (1 - d.count / max) * (H - PAD * 2),
    ...d,
  }));

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="card p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
            Clicks
          </p>
          <p className="mono mt-2 text-[30px] leading-none font-medium tabular-nums">
            {(active ? active.count : total).toLocaleString()}
          </p>
          <p className="mt-1.5 text-[12.5px] text-faint">
            {active
              ? new Date(active.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : `across the last ${range} days`}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                r === range ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[200px] w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${total} clicks across the last ${range} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          // Map the pointer's x back to the nearest data point. The SVG is
          // stretched by preserveAspectRatio="none", so this has to work in
          // fractions of the box's width, not in viewBox units.
          const box = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - box.left) / box.width;
          const i = Math.round(ratio * (data.length - 1));
          setHover(Math.min(data.length - 1, Math.max(0, i)));
        }}
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
          // preserveAspectRatio="none" stretches the viewBox, and would stretch
          // the stroke along with it. This keeps it an even 2px at any width.
          vectorEffect="non-scaling-stroke"
        />

        {active && (
          <>
            <line
              x1={active.x}
              y1="0"
              x2={active.x}
              y2={H}
              stroke="var(--border-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="4"
              fill="var(--matrix)"
              stroke="var(--bg)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      <div className="mono mt-4 flex justify-between text-[11px] text-faint">
        <span>{data[0]?.date}</span>
        <span>{data.at(-1)?.date}</span>
      </div>
    </div>
  );
}
