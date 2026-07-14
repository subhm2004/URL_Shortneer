import { useMemo } from "react";

const TOP_N = 10;
const LABEL_MAX = 26;

function truncateLongUrl(url, max = LABEL_MAX) {
  if (!url) return "—";
  const stripped = url.replace(/^https?:\/\//, "");
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max) + "…";
}

function buildBars(links) {
  const sorted = [...links]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, TOP_N);
  const max = Math.max(1, ...sorted.map((l) => l.clicks || 0));
  return sorted.map((l, i) => ({
    key: l._id || l.slug || i,
    label: truncateLongUrl(l.longUrl),
    fullUrl: l.longUrl,
    clicks: l.clicks || 0,
    pct: (l.clicks || 0) / max,
    rank: i + 1,
  }));
}

export default function ClicksChart({ links, isLoading = false }) {
  const totalClicks = useMemo(
    () => links.reduce((a, l) => a + (l.clicks || 0), 0),
    [links]
  );
  const bars = useMemo(() => buildBars(links), [links]);
  const hasData = bars.length > 0 && totalClicks > 0;

  return (
    <div
      className="chart"
      data-od-id="clicks-chart"
      data-slot="chart"
      data-chart="clicks-by-link"
      role="img"
      aria-label={
        hasData
          ? `Click distribution across top ${bars.length} links. Total clicks: ${totalClicks.toLocaleString()}.`
          : "No click data yet."
      }
    >
      <div className="chart-head">
        <div className="title-block">
          <p className="eyebrow eyebrow-sm">// clicks_by_link</p>
          <h2>clicks_per_link</h2>
        </div>
        <div className="total-block">
          <span className="value num">
            {isLoading ? "—" : totalClicks.toLocaleString()}
          </span>
          <span className="label">total_clicks · all-time</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner-md" />
          <p>loading your clicks…</p>
        </div>
      ) : !hasData ? (
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
            no clicks yet. once people visit your short links, the top links will appear here.
          </p>
        </div>
      ) : (
        <div className="bar-chart">
          {bars.map((b) => (
            <div key={b.key} className="bar-row">
              <span className="bar-rank">{b.rank}.</span>
              <span className="bar-slug" title={b.fullUrl}>
                {b.label}
              </span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(2, b.pct * 100)}%` }}
                />
              </div>
              <span className="bar-count">{b.clicks.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
