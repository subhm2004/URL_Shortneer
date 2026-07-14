import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden px-5">
      <div className="grid-bg" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[1200px] sm:px-4">
        <p className="mono mb-5 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
          404 · no such code
        </p>

        <h1 className="display display-gradient max-w-[16ch] text-[clamp(2.5rem,7vw,5rem)]">
          That link doesn&apos;t resolve.
        </h1>

        <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed text-muted">
          Either the short code never existed, or it was mistyped. Short codes are
          case-sensitive and eight characters long.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Shorten a link <span className="arrow">→</span>
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
