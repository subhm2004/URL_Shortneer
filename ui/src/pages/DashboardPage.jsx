import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserLinks, getClicksByDay } from "../services/linkService";
import Footer from "../components/Footer";
import ClicksChart from "../components/ClicksChart";
import ClicksOverTimeChart from "../components/ClicksOverTimeChart";

/**
 * Shortens the *display* of a short URL, e.g. host/aVeryLongCustom… — the href
 * still points at the full thing.
 *
 * Host-agnostic on purpose: this used to hard-code the production domain, so on
 * localhost (and on any self-hosted deployment) it silently never truncated.
 */
function truncateShortUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const slug = parsed.pathname.replace(/^\//, "");
  if (slug.length <= 10) return url;

  return `${parsed.origin}/${slug.slice(0, 10)}…`;
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CopyIcon() {
  return (
    <svg className="icon icon-copy" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-5A1.5 1.5 0 0 0 3 3.5v5A1.5 1.5 0 0 0 4.5 10H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="icon icon-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

function UrlRow({ url, isShort = false, copiedKey, onCopy }) {
  const visible = isShort ? truncateShortUrl(url) : url;
  const key = isShort ? `s-${url}` : `o-${url}`;
  const copied = copiedKey === key;
  return (
    <div className="url-cell-row">
      <a
        className={`url ${isShort ? "short-cell" : "url-cell"}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
      >
        {visible}
      </a>
      <button
        className={`url-copy ${copied ? "copied" : ""}`}
        data-url={url}
        aria-label={isShort ? "Copy short URL" : "Copy original URL"}
        type="button"
        onClick={() => onCopy(key, url)}
      >
        <CopyIcon />
        <CheckIcon />
      </button>
    </div>
  );
}

function SortArrow({ dir }) {
  return <span className="sort-indicator">{dir === "desc" ? "▼" : "▲"}</span>;
}

export default function DashboardPage() {
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  const [clicksByDay, setClicksByDay] = useState([]);
  const [clicksLoading, setClicksLoading] = useState(true);
  const [clicksError, setClicksError] = useState("");

  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await getUserLinks();
        if (cancelled) return;
        const list = response?.data ?? response?.links ?? [];
        setLinks(
          list.map((l) => ({
            _id: l.id,
            slug: l.urlCode,
            shortUrl: l.shortUrl,
            longUrl: l.longUrl,
            clicks: l.clickCount ?? 0,
            createdAt: l.createdAt,
          }))
        );
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load your links");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    async function loadClicks() {
      if (!isAuthenticated) {
        setClicksLoading(false);
        return;
      }
      try {
        const response = await getClicksByDay(30);
        if (cancelled) return;
        setClicksByDay(response?.data ?? []);
      } catch (err) {
        if (cancelled) return;
        setClicksError(err.message || "Failed to load clicks");
      } finally {
        if (!cancelled) setClicksLoading(false);
      }
    }
    loadClicks();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated]);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sortedLinks = useMemo(() => {
    const sorted = [...links];
    sorted.sort((a, b) => {
      let cmp;
      if (sortField === "clicks") {
        cmp = (a.clicks || 0) - (b.clicks || 0);
        if (cmp === 0) {
          cmp = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
      } else {
        cmp = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [links, sortField, sortDir]);

  async function handleCopy(key, url) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }

  const totalClicks = links.reduce((a, l) => a + (l.clicks || 0), 0);
  const totalLinks = links.length;

  return (
    <>
      <div className="container">
        <div className="page-head">
          <p className="eyebrow">// dashboard</p>
          <h1 className="dashboard">my_dashboard</h1>
          <p className="lead">Welcome back. Here are all the links you have created.</p>
        </div>

        <div className="stats-row" data-od-id="stats">
          <div className="stat-block">
            <span className="label">total_links</span>
            <span className="value num">{totalLinks.toLocaleString()}</span>
          </div>
          <div className="stat-block">
            <span className="label">total_clicks</span>
            <span className="value num">{totalClicks.toLocaleString()}</span>
          </div>
        </div>

        <ClicksChart links={links} isLoading={isLoading} />

        <div id="table-region">
          <div className="table-wrap" data-od-id="links-table">
            {isLoading ? (
              <div className="loading-state">
                <div className="spinner-md" />
                <p>loading your links…</p>
              </div>
            ) : error ? (
              <div className="empty-state">
                <p className="eyebrow">// error</p>
                <p>couldn't load your links: {error}</p>
              </div>
            ) : links.length === 0 ? (
              <div className="empty-state">
                <p className="eyebrow">// no_links_yet</p>
                <p>you haven't shortened anything yet. paste a URL on the shortener page to create your first link.</p>
              </div>
            ) : (
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>original_url</th>
                    <th>short_url</th>
                    <th
                      className={`sortable${sortField === "date" ? " active" : ""}`}
                      onClick={() => handleSort("date")}
                    >
                      created
                      {sortField === "date" && <SortArrow dir={sortDir} />}
                    </th>
                    <th
                      className={`num-col sortable${sortField === "clicks" ? " active" : ""}`}
                      onClick={() => handleSort("clicks")}
                    >
                      clicks
                      {sortField === "clicks" && <SortArrow dir={sortDir} />}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLinks.map((link) => (
                    <tr key={link._id}>
                      <td>
                        <UrlRow
                          url={link.longUrl}
                          isShort={false}
                          copiedKey={copiedKey}
                          onCopy={handleCopy}
                        />
                      </td>
                      <td>
                        <UrlRow
                          url={link.shortUrl}
                          isShort={true}
                          copiedKey={copiedKey}
                          onCopy={handleCopy}
                        />
                      </td>
                      <td className="date-col">{formatDate(link.createdAt)}</td>
                      <td className="num-col">{link.clicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <ClicksOverTimeChart
          data={clicksByDay}
          isLoading={clicksLoading}
          error={clicksError}
        />
      </div>

      <Footer
        meta={`${totalLinks} ${totalLinks === 1 ? "link" : "links"} · ${totalClicks.toLocaleString()} clicks · all-time`}
      />
    </>
  );
}
