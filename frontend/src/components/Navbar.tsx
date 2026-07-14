"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", private: true },
  { href: "/chat", label: "Assistant", private: true },
  { href: "/mcp", label: "MCP", private: false },
  { href: "/#patterns", label: "Architecture", private: false },
];

export default function Navbar() {
  const { isAuthenticated, ready, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { progress, scrolled } = useScrollProgress();

  const visible = LINKS.filter((l) => !l.private || isAuthenticated);

  return (
    /**
     * The bar is borderless and barely-there at the top of the page, and only
     * separates itself once you've scrolled past the hero. A hard line under a
     * header sitting on empty space is a line drawn for no reason.
     */
    <header
      className={`sticky top-0 z-50 transition-[background,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-border bg-bg/80 shadow-[0_1px_24px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl"
          : "border-b border-transparent bg-bg/40 backdrop-blur-sm"
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-9">
        <Link href="/" className="group relative z-10 flex-none">
          <Logo />
        </Link>

        {/*
          Absolutely centred, not laid out between the logo and the buttons.

          `justify-center` inside a flex child would centre the links in whatever
          space is left over — and since the logo and the right-hand controls are
          different widths, that lands visibly off-centre. Pinning to 50% and
          pulling back by half its own width centres it against the page itself,
          whatever sits on either side.
        */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {visible.map((link) => {
            // "/#patterns" is a section of the home page, so it's active only when
            // we're actually on "/". Comparing the whole href would never match.
            const active = link.href.startsWith("/#")
              ? false
              : pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative rounded-lg px-3.5 py-1.5 text-[13.5px] transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {link.label}

                {/* A dot under the current page, rather than a filled pill. The
                    pill made the bar look like a segmented control — four equal
                    buttons, one of them pressed — instead of navigation. */}
                <span
                  className={`absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-matrix transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 ml-auto flex items-center gap-2.5">
          {/* `ready` is false until the client has read localStorage. Rendering an
              auth-dependent control before then flashes "Sign in" at someone who
              is already signed in — and mismatches the server's HTML. */}
          {!ready ? (
            <div className="h-9 w-24" aria-hidden="true" />
          ) : isAuthenticated ? (
            <UserMenu
              name={user?.name ?? null}
              email={user?.email ?? null}
              avatarUrl={user?.avatarUrl ?? null}
              onSignOut={() => {
                logout();
                router.push("/");
              }}
            />
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}

          <a
            href="https://github.com/subhm2004/URL_Shortneer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the source on GitHub"
            className="grid h-9 w-9 flex-none place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <GitHubMark />
          </a>
        </div>
      </div>

      {/*
        Reading progress. Sits on the header's own bottom edge, so it doubles as
        the border once you've scrolled — one line doing two jobs instead of two
        lines competing.

        scaleX rather than width: a width animation is laid out and painted every
        frame; a transform is composited, and never touches layout at all.
      */}
      <div
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-matrix transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})`, opacity: scrolled ? 0.7 : 0 }}
        aria-hidden="true"
      />
    </header>
  );
}

function UserMenu({
  name,
  email,
  avatarUrl,
  onSignOut,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Without both, the menu strands itself
  // open the moment the user's attention moves elsewhere.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-surface"
      >
        <Avatar avatarUrl={avatarUrl} initial={initial} />
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={`text-faint transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="card-raised absolute right-0 mt-2 w-60 overflow-hidden p-1.5"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar avatarUrl={avatarUrl} initial={initial} />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium">
                {name ?? "Signed in"}
              </p>
              <p className="mono truncate text-[11.5px] text-faint">{email ?? ""}</p>
            </div>
          </div>

          <div className="my-1 h-px bg-border-soft" />

          <MenuLink href="/dashboard" onClick={() => setOpen(false)}>
            Dashboard
          </MenuLink>
          <MenuLink href="/mcp" onClick={() => setOpen(false)}>
            MCP token
          </MenuLink>

          <div className="my-1 h-px bg-border-soft" />

          <button
            role="menuitem"
            onClick={onSignOut}
            className="w-full rounded-md px-2.5 py-2 text-left text-[13.5px] text-danger transition-colors hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={30}
        height={30}
        // Google's avatar host isn't in next.config's allowed domains, and adding
        // it there for one image isn't worth the coupling. `unoptimized` serves it
        // straight through.
        unoptimized
        className="h-[30px] w-[30px] flex-none rounded-full object-cover shadow-[var(--ring)]"
      />
    );
  }

  return (
    <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-surface-3 text-[12.5px] font-semibold text-fg-2">
      {initial}
    </span>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="block rounded-md px-2.5 py-2 text-[13.5px] text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </Link>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
