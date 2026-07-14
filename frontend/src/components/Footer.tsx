import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-32 border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-9">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-[12px] font-bold text-fg-2">
            T
          </span>
          <span className="text-[13px] text-muted">
            Trunc — cut it short. © {new Date().getFullYear()}
          </span>
        </div>

        <div className="mono flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-faint">
          <span>postgres</span>
          <span>express</span>
          <span>next.js</span>
          <span>mcp</span>
          <Link
            href="/mcp"
            className="text-muted transition-colors hover:text-fg"
          >
            /mcp
          </Link>
          <a
            href="https://github.com/subhm2004/URL_Shortneer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-fg"
          >
            source
          </a>
        </div>
      </div>
    </footer>
  );
}
