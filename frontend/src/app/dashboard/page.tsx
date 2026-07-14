"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  clicksByDay,
  deleteLink,
  myLinks,
  repointLink,
} from "@/lib/api";
import type { DayCount, ShortUrl } from "@/lib/types";
import { useAuth } from "@/context/AuthProvider";
import Sparkline from "@/components/Sparkline";

type SortKey = "clicks" | "created";

/**
 * Deliberately small. The dashboard used to fetch every link a user had ever
 * created — fine at ten, fatal at ten thousand.
 */
const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { isAuthenticated, ready, user } = useAuth();
  const router = useRouter();

  const [links, setLinks] = useState<ShortUrl[]>([]);
  const [days, setDays] = useState<DayCount[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [copied, setCopied] = useState<string | null>(null);

  /** Keyset cursor for the next page. null ⇒ we've reached the end. */
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** The link the user is being asked to confirm deleting. */
  const [confirmDelete, setConfirmDelete] = useState<ShortUrl | null>(null);
  /** The link being edited, and the destination they're typing. */
  const [editing, setEditing] = useState<ShortUrl | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // `ready` guards this: on the first client render the token hasn't been read
  // yet, so isAuthenticated is still false. Redirecting on that would bounce a
  // signed-in user back to /login on every refresh.
  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const [page, dayRows] = await Promise.all([
          myLinks({ limit: PAGE_SIZE }),
          clicksByDay(range),
        ]);
        if (cancelled) return;
        setLinks(page.links);
        setCursor(page.nextCursor);
        setDays(dayRows);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.isAuthError) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load your links.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, isAuthenticated, router, range]);

  const sorted = useMemo(() => {
    const rows = [...links];
    rows.sort((a, b) =>
      sort === "clicks"
        ? b.clickCount - a.clickCount
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    return rows;
  }, [links, sort]);

  const totalClicks = useMemo(
    () => links.reduce((sum, l) => sum + l.clickCount, 0),
    [links],
  );

  const best = useMemo(
    () =>
      links.reduce<ShortUrl | null>(
        (top, l) => (!top || l.clickCount > top.clickCount ? l : top),
        null,
      ),
    [links],
  );

  const clicksInRange = useMemo(
    () => days.reduce((sum, d) => sum + d.count, 0),
    [days],
  );

  async function loadMore() {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const page = await myLinks({ limit: PAGE_SIZE, cursor });
      setLinks((current) => [...current, ...page.links]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(link: ShortUrl) {
    setRowBusy(link.urlCode);
    setError("");

    try {
      await deleteLink(link.urlCode);
      // Drop it locally rather than refetching the page: a refetch would reset
      // the user's scroll position and re-request every page they'd loaded.
      setLinks((current) => current.filter((l) => l.id !== link.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that link.");
    } finally {
      setRowBusy(null);
    }
  }

  async function handleRepoint() {
    if (!editing) return;

    setRowBusy(editing.urlCode);
    setError("");

    try {
      const updated = await repointLink(editing.urlCode, editUrl.trim());
      setLinks((current) =>
        current.map((l) => (l.id === updated.id ? updated : l)),
      );
      setEditing(null);
    } catch (err) {
      // The backend runs the new URL through the same validation chain as a new
      // link, so this is where "javascript:…" or a private host lands. Show it.
      setError(err instanceof Error ? err.message : "Could not update that link.");
    } finally {
      setRowBusy(null);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; // don't claim a success we didn't have
    }
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1600);
  }

  if (!ready || loading) {
    return (
      <div className="grid min-h-[70dvh] place-items-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-fg" />
      </div>
    );
  }

  if (!isAuthenticated) return null; // the redirect above is in flight

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="relative overflow-hidden">
      <div className="grid-bg" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1200px] px-5 py-12 sm:px-9">
        {/* ---- header ---- */}
        <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mono mb-3 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
              Dashboard
            </p>
            <h1 className="display text-[clamp(1.9rem,3.6vw,2.6rem)]">
              {firstName ? `Welcome back, ${firstName}.` : "Your links."}
            </h1>
            <p className="mt-3 text-[15px] text-muted">
              {links.length === 0
                ? "Nothing here yet — shorten something and it'll show up."
                : `${links.length} link${links.length === 1 ? "" : "s"} · ${totalClicks.toLocaleString()} click${totalClicks === 1 ? "" : "s"} all time`}
            </p>
          </div>

          <Link href="/" className="btn btn-primary">
            New link <span className="arrow">→</span>
          </Link>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-8 rounded-lg px-4 py-3 text-[13.5px] text-danger"
            style={{
              background: "color-mix(in oklab, var(--danger) 10%, transparent)",
              boxShadow:
                "0 0 0 1px color-mix(in oklab, var(--danger) 35%, transparent)",
            }}
          >
            {error}
          </p>
        )}

        {/* ---- stats ---- */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Links" value={links.length} />
          <Stat label="Clicks — all time" value={totalClicks} accent />
          <Stat label={`Clicks — ${range}d`} value={clicksInRange} />
          <Stat
            label="Avg per link"
            value={links.length ? Math.round(totalClicks / links.length) : 0}
          />
        </div>

        {/* ---- chart + top link ---- */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.9fr_1fr]">
          {days.length > 0 ? (
            <Sparkline data={days} range={range} onRangeChange={setRange} />
          ) : (
            <div className="card grid place-items-center p-10 text-[14px] text-muted">
              No click data yet.
            </div>
          )}

          <div className="card flex flex-col p-6">
            <p className="mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
              Top link
            </p>

            {best && best.clickCount > 0 ? (
              <div className="mt-4 flex flex-1 flex-col justify-between gap-6">
                <div>
                  <a
                    href={best.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-[16px] font-medium text-matrix hover:underline"
                  >
                    /{best.urlCode}
                  </a>
                  <p
                    className="mt-2 text-[13px] break-all text-muted"
                    title={best.longUrl}
                  >
                    {best.longUrl.length > 70
                      ? `${best.longUrl.slice(0, 70)}…`
                      : best.longUrl}
                  </p>
                </div>

                <div>
                  <p className="mono text-[32px] leading-none font-medium tabular-nums">
                    {best.clickCount.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-faint">
                    {totalClicks > 0
                      ? `${Math.round((best.clickCount / totalClicks) * 100)}% of all your clicks`
                      : "clicks"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 flex-1 text-[13.5px] text-muted">
                No clicks yet. Share a link and it&apos;ll show up here.
              </p>
            )}
          </div>
        </div>

        {/* ---- table ---- */}
        {links.length === 0 ? (
          <div className="card grid place-items-center gap-5 border-dashed p-16 text-center">
            <div>
              <h2 className="text-[17px] font-semibold">No links yet</h2>
              <p className="mt-2 text-[14px] text-muted">
                Shorten your first URL and watch the pipeline run.
              </p>
            </div>
            <Link href="/" className="btn btn-primary">
              Shorten a link <span className="arrow">→</span>
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
              <h2 className="text-[15px] font-semibold">
                All links{" "}
                <span className="mono ml-1 text-[12.5px] font-normal text-faint">
                  {links.length}
                </span>
              </h2>

              <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
                <Toggle
                  active={sort === "created"}
                  onClick={() => setSort("created")}
                >
                  Newest
                </Toggle>
                <Toggle active={sort === "clicks"} onClick={() => setSort("clicks")}>
                  Most clicked
                </Toggle>
              </div>
            </div>

            {/* Scrolls inside its own box, so the page body never scrolls sideways
                on a narrow screen. */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="mono text-[10.5px] tracking-[0.12em] text-faint uppercase">
                    <th className="px-6 py-3 font-medium">Short</th>
                    <th className="px-6 py-3 font-medium">Destination</th>
                    <th className="px-6 py-3 text-right font-medium">Clicks</th>
                    <th className="px-6 py-3 font-medium">Created</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((link) => {
                    // A faint bar behind each row, proportional to the busiest
                    // link. Reads as a chart without needing to be one.
                    const share =
                      best && best.clickCount > 0
                        ? (link.clickCount / best.clickCount) * 100
                        : 0;

                    return (
                      <tr
                        key={link.id}
                        className="group border-t border-border-soft transition-colors hover:bg-surface-2"
                      >
                        <td className="relative px-6 py-4">
                          <span
                            className="pointer-events-none absolute inset-y-0 left-0 bg-matrix opacity-[0.05]"
                            style={{ width: `${share}%` }}
                            aria-hidden="true"
                          />
                          <a
                            href={link.shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono relative text-matrix hover:underline"
                          >
                            /{link.urlCode}
                          </a>
                        </td>

                        <td className="max-w-[360px] truncate px-6 py-4 text-muted">
                          <a
                            href={link.longUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={link.longUrl}
                            className="hover:text-fg hover:underline"
                          >
                            {link.longUrl}
                          </a>
                        </td>

                        <td className="mono px-6 py-4 text-right tabular-nums">
                          {link.clickCount.toLocaleString()}
                        </td>

                        <td className="mono px-6 py-4 text-[12px] whitespace-nowrap text-faint">
                          {new Date(link.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              onClick={() => copy(link.shortUrl)}
                              className="btn btn-ghost btn-sm"
                            >
                              {copied === link.shortUrl ? "Copied" : "Copy"}
                            </button>

                            <button
                              onClick={() => {
                                setEditing(link);
                                setEditUrl(link.longUrl);
                                setError("");
                              }}
                              className="btn btn-ghost btn-sm"
                              aria-label={`Edit /${link.urlCode}`}
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => {
                                setConfirmDelete(link);
                                setError("");
                              }}
                              disabled={rowBusy === link.urlCode}
                              className="btn btn-ghost btn-sm text-danger hover:bg-surface-3"
                              aria-label={`Delete /${link.urlCode}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Keyset pagination: the cursor's existence *is* the "has more"
                signal, so there's no separate count query to ask. */}
            {cursor && (
              <div className="flex justify-center border-t border-border-soft p-5">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary btn-sm"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- edit ---- */}
      {editing && (
        <Modal
          title={`Repoint /${editing.urlCode}`}
          onClose={() => setEditing(null)}
        >
          <p className="text-[13.5px] leading-relaxed text-muted">
            The short code stays the same — everyone who already has this link
            keeps working. Only the destination changes.
          </p>

          <label htmlFor="edit-url" className="label mt-6">
            New destination
          </label>
          <input
            id="edit-url"
            type="url"
            className="input mono text-[13px]"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            autoFocus
          />

          <div className="mt-7 flex justify-end gap-2">
            <button
              onClick={() => setEditing(null)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRepoint}
              disabled={
                !editUrl.trim() ||
                editUrl.trim() === editing.longUrl ||
                rowBusy === editing.urlCode
              }
              className="btn btn-primary btn-sm"
            >
              {rowBusy === editing.urlCode ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* ---- delete ---- */}
      {confirmDelete && (
        <Modal
          title={`Delete /${confirmDelete.urlCode}?`}
          onClose={() => setConfirmDelete(null)}
        >
          {/* Deletion cascades to the clicks table, and there is no undo. Saying
              so plainly is cheaper than building one. */}
          <p className="text-[13.5px] leading-relaxed text-muted">
            The link stops working immediately, and its{" "}
            <span className="mono text-fg-2">
              {confirmDelete.clickCount.toLocaleString()}
            </span>{" "}
            click{confirmDelete.clickCount === 1 ? "" : "s"} are deleted with it.
            This cannot be undone.
          </p>

          <p className="mono mt-4 truncate rounded-lg bg-surface-2 px-3.5 py-2.5 text-[12px] text-faint">
            {confirmDelete.longUrl}
          </p>

          <div className="mt-7 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="btn btn-secondary btn-sm"
            >
              Keep it
            </button>
            <button
              onClick={() => handleDelete(confirmDelete)}
              disabled={rowBusy === confirmDelete.urlCode}
              className="btn btn-sm border-danger bg-danger text-bg hover:opacity-90"
            >
              {rowBusy === confirmDelete.urlCode ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * A modal. Closes on Escape and on a click outside — both, because a dialog that
 * traps you until you find its button is a dialog people learn to dread.
 */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-bg/70 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card-raised slide-up w-full max-w-[460px] p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="card p-5 transition-colors hover:bg-surface-2">
      <p className="mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
        {label}
      </p>
      <p
        className={`mono mt-2.5 text-[30px] leading-none font-medium tabular-nums ${
          accent ? "text-matrix" : "text-fg"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
        active ? "bg-surface-3 text-fg" : "text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
