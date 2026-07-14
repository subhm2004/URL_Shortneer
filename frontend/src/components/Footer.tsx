import Link from "next/link";
import { LogoMark } from "./Logo";
import StatusDot from "./StatusDot";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Shorten a link", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Assistant", href: "/chat" },
      { label: "MCP guide", href: "/mcp" },
    ],
  },
  {
    title: "Architecture",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Design patterns", href: "/#patterns" },
      { label: "The assistant", href: "/#assistant" },
    ],
  },
  {
    title: "Developers",
    links: [
      {
        label: "Source",
        href: "https://github.com/subhm2004/URL_Shortneer",
        external: true,
      },
      {
        label: "Report an issue",
        href: "https://github.com/subhm2004/URL_Shortneer/issues",
        external: true,
      },
      {
        label: "MIT License",
        href: "https://github.com/subhm2004/URL_Shortneer/blob/main/LICENSE",
        external: true,
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative mt-28 overflow-hidden border-t border-border">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
        {/* ---- columns ---- */}
        <div className="grid gap-12 py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-[34ch]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface-2 text-fg shadow-[var(--ring)]">
                <LogoMark size={20} />
              </span>
              <span className="text-[15.5px] font-semibold tracking-[-0.02em]">
                Trunc
              </span>
            </div>

            <p className="mt-5 text-[13.5px] leading-relaxed text-muted">
              A URL shortener that shows you its own machinery. Paste a link and
              watch every layer of the request execute, in order, as it happens.
            </p>

            <div className="mt-6">
              <StatusDot />
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title}>
              <h3 className="mono mb-4 text-[10.5px] tracking-[0.14em] text-faint uppercase">
                {column.title}
              </h3>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13.5px] text-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13.5px] text-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ---- bottom bar ---- */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-soft py-7">
          <p className="text-[12.5px] text-faint">
            © {new Date().getFullYear()} Trunc. Built by{" "}
            <a
              href="https://github.com/subhm2004"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-fg"
            >
              Shubham Malik
            </a>
            .
          </p>

          <a
            href="https://github.com/subhm2004/URL_Shortneer"
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11.5px] text-faint transition-colors hover:text-fg"
          >
            open source · MIT
          </a>
        </div>
      </div>

      {/*
        The wordmark, oversized and mostly cut off by the bottom of the page.
        Purely typographic — it gives the footer a floor to sit on instead of the
        page just stopping. aria-hidden because it says nothing a screen reader
        hasn't already been told.
      */}
      <p
        className="display pointer-events-none -mb-[3.5vw] w-full text-center text-[18vw] leading-none text-fg select-none"
        style={{
          background:
            "linear-gradient(180deg, var(--surface-3) 0%, transparent 78%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
        aria-hidden="true"
      >
        TRUNC
      </p>
    </footer>
  );
}
