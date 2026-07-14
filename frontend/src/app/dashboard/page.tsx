"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, clicksByDay, myLinks } from "@/lib/api";
import type { DayCount, ShortUrl } from "@/lib/types";
import { useAuth } from "@/context/AuthProvider";
import Sparkline from "@/components/Sparkline";

type SortKey = "clicks" | "created";

export default function DashboardPage() {
  const { isAuthenticated, ready } = useAuth();
  const router = useRouter();

  const [links, setLinks] = useState<ShortUrl[]>([]);
  const [days, setDays] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [copied, setCopied] = useState<string | null>(null);

  // `ready` guards this: on the very first client render the token hasn't been
  // read yet, so isAuthenticated is still false. Redirecting on that would bounce
  // a signed-in user straight back to /login on every refresh.
  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const [linkRows, dayRows] = await Promise.all([myLinks(), clicksByDay(30)]);
        if (cancelled) return;
        setLinks(linkRows);
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
  }, [ready, isAuthenticated, router]);

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
      <div className="grid min-h-[60dvh] place-items-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-fg" />
      </div>
    );
  }

  if (!isAuthenticated) return null; // the redirect above is in flight

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-9">
      <header className="mb-10">
        <h1 className="display text-[clamp(1.8rem,3.4vw,2.5rem)] text-fg">
          Your links
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          Every link you&apos;ve created, and how often each one is clicked.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-8 rounded-lg px-4 py-3 text-[13.5px] text-danger"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            boxShadow: "0 0 0 1px color-mix(in oklab, var(--danger) 35%, transparent)",
          }}
        >
          {error}
        </p>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Links" value={links.length} />
        <Stat label="Total clicks" value={totalClicks} />
        <Stat
          label="Avg per link"
          value={links.length ? Math.round(totalClicks / links.length) : 0}
        />
      </div>

      {days.length > 0 && (
        <div className="mb-8">
          <Sparkline data={days} />
        </div>
      )}

      {links.length === 0 ? (
        <div className="card grid place-items-center gap-4 border-dashed p-16 text-center">
          <p className="text-[15px] text-muted">You haven&apos;t created any links yet.</p>
          <Link href="/" className="btn btn-primary">
            Shorten your first link <span className="arrow">→</span>
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-[15px] font-semibold">
              {links.length} link{links.length === 1 ? "" : "s"}
            </h2>
            <div className="flex gap-1">
              <SortButton active={sort === "created"} onClick={() => setSort("created")}>
                Newest
              </SortButton>
              <SortButton active={sort === "clicks"} onClick={() => setSort("clicks")}>
                Most clicked
              </SortButton>
            </div>
          </div>

          {/* The table scrolls inside its own box so the page body never scrolls
              sideways on a narrow screen. */}
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
                {sorted.map((link) => (
                  <tr
                    key={link.id}
                    className="border-t border-border-soft transition-colors hover:bg-surface-2"
                  >
                    <td className="px-6 py-4">
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-matrix hover:underline"
                      >
                        /{link.urlCode}
                      </a>
                    </td>
                    <td className="max-w-[340px] truncate px-6 py-4 text-muted">
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
                    <td className="mono px-6 py-4 text-right tabular-nums text-fg">
                      {link.clickCount.toLocaleString()}
                    </td>
                    <td className="mono px-6 py-4 text-[12px] whitespace-nowrap text-faint">
                      {new Date(link.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => copy(link.shortUrl)}
                        className="btn btn-ghost btn-sm"
                      >
                        {copied === link.shortUrl ? "Copied" : "Copy"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-6">
      <p className="mono text-[10.5px] tracking-[0.14em] text-faint uppercase">
        {label}
      </p>
      <p className="mono mt-2 text-[28px] leading-none font-medium tabular-nums text-fg">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function SortButton({
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
