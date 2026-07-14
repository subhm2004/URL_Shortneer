/**
 * The mark: a chain link, severed.
 *
 * The left half is drawn in the foreground colour and the right half in the
 * brand green, with a deliberate gap between them — a link, cut short. That is
 * the product's name and the product's job in one glyph.
 *
 * Built from two arcs and two bars rather than a single path, so the two halves
 * can carry different colours and the gap stays a real gap at any size. Stroke
 * widths are chosen to survive 16px, where a chain link usually turns to mush.
 */
export function LogoMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* left half — intact */}
      <path d="M10.5 16.5H8a4.5 4.5 0 0 1 0-9h2.5" stroke="currentColor" />
      <path d="M8.5 12h2.5" stroke="currentColor" />

      {/* right half — the cut. Offset from the left half so the gap reads as a
          severed link rather than a rendering glitch. */}
      <path d="M13.5 7.5H16a4.5 4.5 0 0 1 0 9h-2.5" stroke="var(--matrix)" />
      <path d="M13 12h2.5" stroke="var(--matrix)" />
    </svg>
  );
}

/** Mark + wordmark, for the navbar. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-surface-2 text-fg shadow-[var(--ring)] transition-colors group-hover:bg-surface-3">
        <LogoMark size={20} />
      </span>
      <span className="text-[15.5px] font-semibold tracking-[-0.02em]">Trunc</span>
    </span>
  );
}
