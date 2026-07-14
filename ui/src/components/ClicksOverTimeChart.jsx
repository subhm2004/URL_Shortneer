import { useEffect, useMemo, useRef } from "react";

const PLOT = { left: 40, right: 792, top: 12, bottom: 232, w: 800, h: 260 };

function fmtShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtFull(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClicksOverTimeChart({ data = [], isLoading = false, error = "" }) {
  const gridRef = useRef(null);
  const yAxisRef = useRef(null);
  const lineRef = useRef(null);
  const areaRef = useRef(null);
  const hoverLineRef = useRef(null);
  const hoverDotRef = useRef(null);
  const overlayRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const ttDayRef = useRef(null);
  const ttCountRef = useRef(null);
  const xAxisRef = useRef(null);
  const totalRef = useRef(null);

  const total = useMemo(() => data.reduce((a, d) => a + d.count, 0), [data]);
  const maxY = useMemo(() => Math.max(10, ...data.map((d) => d.count)), [data]);
  const N = data.length;
  const hasData = N >= 2 && total > 0;

  const pts = useMemo(() => {
    if (N < 2) return [];
    return data.map((d, i) => ({
      x: PLOT.left + (i / (N - 1)) * (PLOT.right - PLOT.left),
      y: PLOT.bottom - (d.count / maxY) * (PLOT.bottom - PLOT.top),
      d,
    }));
  }, [data, maxY, N]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.innerHTML = "";
    if (yAxisRef.current) yAxisRef.current.innerHTML = "";

    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = PLOT.top + ((PLOT.bottom - PLOT.top) / steps) * i;
      const val = Math.round(maxY - (maxY / steps) * i);
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", PLOT.left);
      ln.setAttribute("x2", PLOT.right);
      ln.setAttribute("y1", y);
      ln.setAttribute("y2", y);
      gridRef.current?.appendChild(ln);

      const tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tx.setAttribute("x", PLOT.left - 8);
      tx.setAttribute("y", y);
      tx.setAttribute("text-anchor", "end");
      tx.setAttribute("class", "axis-text");
      tx.textContent = val;
      yAxisRef.current?.appendChild(tx);
    }

    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxis.setAttribute("x1", PLOT.left);
    xAxis.setAttribute("x2", PLOT.right);
    xAxis.setAttribute("y1", PLOT.bottom);
    xAxis.setAttribute("y2", PLOT.bottom);
    xAxis.setAttribute("class", "axis-line");
    yAxisRef.current?.appendChild(xAxis);

    if (xAxisRef.current) xAxisRef.current.innerHTML = "";
    if (N > 0) {
      const indices =
        N <= 6
          ? Array.from({ length: N }, (_, i) => i)
          : [0, Math.floor(N * 0.2), Math.floor(N * 0.4), Math.floor(N * 0.6), Math.floor(N * 0.8), N - 1];
      indices.forEach((i) => {
        if (i < 0 || i >= N) return;
        const s = document.createElement("span");
        s.textContent = fmtShort(data[i].date);
        xAxisRef.current?.appendChild(s);
      });
    }

    if (pts.length >= 2) {
      const tension = 0.2;
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) * tension;
        const c1y = p1.y + (p2.y - p0.y) * tension;
        const c2x = p2.x - (p3.x - p1.x) * tension;
        const c2y = p2.y - (p3.y - p1.y) * tension;
        d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
      }
      if (lineRef.current) lineRef.current.setAttribute("d", d);
      const areaD =
        d +
        ` L ${pts[pts.length - 1].x.toFixed(2)},${PLOT.bottom} L ${pts[0].x.toFixed(2)},${PLOT.bottom} Z`;
      if (areaRef.current) areaRef.current.setAttribute("d", areaD);
    } else {
      if (lineRef.current) lineRef.current.setAttribute("d", "");
      if (areaRef.current) areaRef.current.setAttribute("d", "");
    }

    if (totalRef.current) {
      totalRef.current.textContent = isLoading ? "—" : total.toLocaleString();
    }
  }, [pts, total, data, N, maxY, isLoading]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const svg = svgRef.current;
    const hoverLine = hoverLineRef.current;
    const hoverDot = hoverDotRef.current;
    const tooltip = tooltipRef.current;
    if (!overlay || !svg || !hoverLine || !hoverDot || !tooltip) return;
    if (pts.length < 2) return;

    const findNearest = (mx) => {
      let n = 0;
      let m = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const dist = Math.abs(pts[i].x - mx);
        if (dist < m) {
          m = dist;
          n = i;
        }
      }
      return n;
    };

    function onMove(e) {
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const svgX = (mx / rect.width) * PLOT.w;
      const idx = findNearest(svgX);
      const p = pts[idx];
      hoverLine.setAttribute("x1", p.x);
      hoverLine.setAttribute("x2", p.x);
      hoverLine.setAttribute("y1", PLOT.top);
      hoverLine.setAttribute("y2", PLOT.bottom);
      hoverDot.setAttribute("cx", p.x);
      hoverDot.setAttribute("cy", p.y);
      svg.classList.add("in-hover");
      if (ttDayRef.current) ttDayRef.current.textContent = fmtFull(p.d.date);
      if (ttCountRef.current) ttCountRef.current.textContent = p.d.count.toLocaleString();
      const ttW = tooltip.offsetWidth;
      const ttH = tooltip.offsetHeight;
      let tx = mx + 14;
      let ty = my + 14;
      if (mx + ttW + 28 > rect.width) tx = mx - ttW - 14;
      if (my + ttH + 28 > rect.height) ty = my - ttH - 14;
      tx = Math.max(4, Math.min(rect.width - ttW - 4, tx));
      ty = Math.max(4, Math.min(rect.height - ttH - 4, ty));
      tooltip.style.transform = `translate(${tx}px, ${ty}px)`;
      tooltip.classList.add("show");
      tooltip.setAttribute("aria-hidden", "false");
    }
    function onLeave() {
      svg.classList.remove("in-hover");
      tooltip.classList.remove("show");
      tooltip.setAttribute("aria-hidden", "true");
    }
    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("mouseleave", onLeave);
    return () => {
      overlay.removeEventListener("mousemove", onMove);
      overlay.removeEventListener("mouseleave", onLeave);
    };
  }, [pts]);

  if (isLoading) {
    return (
      <div
        className="chart"
        data-od-id="clicks-over-time"
        data-slot="chart"
        data-chart="clicks-30d"
      >
        <div className="chart-head">
          <div className="title-block">
            <p className="eyebrow eyebrow-sm">// clicks_over_time</p>
            <h2>total_clicks_per_day</h2>
          </div>
        </div>
        <div className="loading-state">
          <div className="spinner-md" />
          <p>loading clicks…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="chart"
        data-od-id="clicks-over-time"
        data-slot="chart"
        data-chart="clicks-30d"
      >
        <div className="chart-head">
          <div className="title-block">
            <p className="eyebrow eyebrow-sm">// clicks_over_time</p>
            <h2>total_clicks_per_day</h2>
          </div>
        </div>
        <div
          className="empty-state"
          style={{
            border: "none",
            boxShadow: "none",
            background: "transparent",
            padding: "32px 8px",
          }}
        >
          <p className="eyebrow">// error</p>
          <p>couldn't load clicks: {error}</p>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        className="chart"
        data-od-id="clicks-over-time"
        data-slot="chart"
        data-chart="clicks-30d"
      >
        <div className="chart-head">
          <div className="title-block">
            <p className="eyebrow eyebrow-sm">// clicks_over_time</p>
            <h2>total_clicks_per_day</h2>
          </div>
          <div className="total-block">
            <span className="value num">0</span>
            <span className="label">last_30_days · combined</span>
          </div>
        </div>
        <div
          className="empty-state"
          style={{
            border: "none",
            boxShadow: "none",
            background: "transparent",
            padding: "32px 8px",
          }}
        >
          <p className="eyebrow">// no_data</p>
          <p>
            no clicks recorded in the last {N || 30} days. the line will start to fill in as people visit your short links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chart"
      data-od-id="clicks-over-time"
      data-slot="chart"
      data-chart="clicks-30d"
      role="img"
      aria-label={`Total clicks per day over the last ${N} days. Total: ${total.toLocaleString()}.`}
    >
      <div className="chart-head">
        <div className="title-block">
          <p className="eyebrow eyebrow-sm">// clicks_over_time</p>
          <h2>total_clicks_per_day</h2>
        </div>
        <div className="total-block">
          <span className="value num" ref={totalRef}>—</span>
          <span className="label">last_30_days · combined</span>
        </div>
      </div>
      <div className="chart-body">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${PLOT.w} ${PLOT.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          ref={svgRef}
        >
          <g className="grid" ref={gridRef}></g>
          <g className="axis" ref={yAxisRef}></g>
          <path className="area" ref={areaRef} d=""></path>
          <path className="line" ref={lineRef} d=""></path>
          <line className="hover-line" ref={hoverLineRef} x1="0" y1="0" x2="0" y2={PLOT.bottom}></line>
          <circle className="hover-dot" ref={hoverDotRef} cx="0" cy="0" r="4"></circle>
        </svg>
        <div className="chart-overlay" ref={overlayRef} aria-hidden="true"></div>
        <div
          className="chart-tooltip"
          ref={tooltipRef}
          role="tooltip"
          aria-hidden="true"
        >
          <div className="tt-day" ref={ttDayRef}>—</div>
          <div className="tt-total">
            <span className="lbl">clicks</span>
            <span className="val" ref={ttCountRef}>—</span>
          </div>
        </div>
      </div>
      <div className="chart-x-axis" ref={xAxisRef}></div>
    </div>
  );
}
