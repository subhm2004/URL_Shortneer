import Link from "next/link";
import Shortener from "@/components/Shortener";
import Reveal from "@/components/Reveal";

const STACK = ["Postgres", "Express", "Next.js", "TypeScript", "MCP"];

const PATTERNS = [
  { n: "01", name: "Singleton", where: "config · pool · logger", why: "One Postgres pool per process. A pool per request would exhaust the connection limit." },
  { n: "02", name: "Repository", where: "User · Url · Click", why: "SQL sits behind an interface, so no service ever imports a database driver." },
  { n: "03", name: "Template Method", where: "BaseRepository", why: "Subclasses declare the table; they inherit the query and transaction plumbing." },
  { n: "04", name: "Decorator", where: "CachedUrlRepository", why: "Adds caching to the redirect lookup without a single service knowing it exists." },
  { n: "05", name: "Null Object", where: "NullCache", why: "Turning the cache off is an injection, not a codebase full of null checks." },
  { n: "06", name: "Strategy", where: "NanoId · Base62 · Alias", why: "Swap how codes are minted with an env var. No service code moves." },
  { n: "07", name: "Factory", where: "ShortCodeStrategyFactory", why: "The one place that knows the concrete strategy classes by name." },
  { n: "08", name: "Chain of Responsibility", where: "UrlValidator", why: "Each rule rejects or passes along. Order is configuration, not control flow." },
  { n: "09", name: "Observer", where: "EventBus", why: "The redirect answers immediately; clicks are recorded on the next tick." },
  { n: "10", name: "Builder", where: "ApiResponse", why: "One response envelope, decided once, instead of five that drifted apart." },
  { n: "11", name: "Dependency Injection", where: "container.ts", why: "Everything takes its collaborators in. That is what makes it testable." },
  { n: "12", name: "Facade", where: "lib/api.ts", why: "Three service files repeated the same fetch and error dance. Now they don't." },
];

const RECEIPTS = [
  {
    claim: "50 concurrent clicks → 51 counted",
    detail:
      "An atomic UPDATE … SET click_count = click_count + 1. The read-modify-write it replaced silently dropped increments under load.",
  },
  {
    claim: "javascript: and 169.254.169.254 rejected",
    detail:
      "A protocol allowlist and a private-host rule. A shortener without them is an XSS vector and an SSRF gadget wearing your own domain.",
  },
  {
    claim: "Clicks aggregated in Postgres",
    detail:
      "generate_series joins a date spine, so quiet days come back as zero. The old version pulled every click into Node and counted them in a Map.",
  },
  {
    claim: "urls.url_code is UNIQUE",
    detail:
      "It is the redirect key. Without the constraint two links could collide, and one of them would send visitors to the wrong site.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Paste any link",
    body: "Long, ugly, full of UTM parameters. It goes through six validation rules before anything is written.",
  },
  {
    n: "02",
    title: "Watch it resolve",
    body: "The pipeline above is not a mock. Those are the layers your request actually passes through, in the order it passes them.",
  },
  {
    n: "03",
    title: "Track every click",
    body: "Each visit is recorded after the redirect has already answered — so the person clicking never waits on our analytics.",
  },
];

export default function Home() {
  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28">
        <div className="grid-bg" aria-hidden="true" />
        <div className="spotlight" aria-hidden="true" />

        <div className="relative mx-auto max-w-[1200px] px-5 sm:px-9">
          <div className="flex flex-col items-center text-center">
            <div className="pill">
              <span className="pill-dot" />
              <span>Live pipeline — watch the request run</span>
            </div>

            {/* text-balance evens out the two lines instead of leaving one word
                stranded on the second. */}
            <h1 className="display display-gradient mt-8 max-w-[15ch] text-balance text-[clamp(2.75rem,7.5vw,5.25rem)]">
              Paste a link. Watch it resolve.
            </h1>

            <p className="mt-7 max-w-[58ch] text-[17px] leading-relaxed text-muted">
              Most shorteners hide the machinery. Trunc shows it to you — every
              layer your request passes through lights up, in order, as it happens.
            </p>
          </div>

          {/* The form is the call to action. Anything else would be a detour
              around the product. */}
          <div className="mt-12">
            <Shortener />
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {STACK.map((tech) => (
              <span key={tech} className="mono text-[12px] tracking-wide text-faint">
                {tech}
              </span>
            ))}
          </div>

          <div className="mt-14 flex justify-center">
            <a
              href="#how"
              aria-label="Scroll to how it works"
              className="grid h-10 w-10 place-items-center rounded-full text-muted shadow-[var(--ring)] transition-colors hover:bg-surface hover:text-fg"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section id="how" className="scroll-mt-20 border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
              How it works
            </p>
            <h2 className="display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.75rem)] text-fg">
              Three steps, none of them hidden.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-border shadow-[var(--ring)] md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 80}>
                <div className="h-full bg-bg p-8 transition-colors hover:bg-surface">
                  <span className="mono text-[12px] text-faint">{step.n}</span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- patterns */}
      <section id="patterns" className="scroll-mt-20 border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
              The twelve
            </p>
            <h2 className="display max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.75rem)] text-fg">
              Every pattern here earns its place.
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-muted">
              None were added to pad a list. Each one is here because something was
              hard to change, unsafe, or slow without it — the last line of each card
              says which.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl bg-border shadow-[var(--ring)] sm:grid-cols-2 lg:grid-cols-3">
            {PATTERNS.map((p, i) => (
              <Reveal key={p.n} delay={(i % 3) * 60}>
                <article className="group h-full bg-bg p-7 transition-colors hover:bg-surface">
                  <div className="flex items-baseline gap-2.5">
                    <span className="mono text-[11px] text-faint">{p.n}</span>
                    <h3 className="text-[15.5px] font-semibold tracking-tight">
                      {p.name}
                    </h3>
                  </div>
                  <p className="mono mt-2.5 text-[11.5px] text-matrix opacity-60">
                    {p.where}
                  </p>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                    {p.why}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- receipts */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
              Receipts
            </p>
            <h2 className="display max-w-[22ch] text-[clamp(1.9rem,3.6vw,2.75rem)] text-fg">
              Four bugs the rewrite actually fixed.
            </h2>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-muted">
              Patterns are the means; these are the ends. Each one is verified
              against a live Postgres in CI, not asserted in a README.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {RECEIPTS.map((r, i) => (
              <Reveal key={r.claim} delay={(i % 2) * 70}>
                <div className="card flex h-full gap-4 p-6">
                  <span
                    className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] text-success"
                    style={{
                      background:
                        "color-mix(in oklab, var(--success) 14%, transparent)",
                    }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <div>
                    <h3 className="mono text-[13.5px] font-medium text-fg">
                      {r.claim}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                      {r.detail}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- mcp */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <div className="card-raised relative overflow-hidden p-10 sm:p-14">
              <div className="spotlight opacity-60" aria-hidden="true" />

              <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-[52ch]">
                  <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
                    Also for agents
                  </p>
                  <h2 className="display text-[clamp(1.7rem,3vw,2.4rem)] text-fg">
                    Your AI assistant can use it too.
                  </h2>
                  <p className="mt-5 text-[15px] leading-relaxed text-muted">
                    An MCP server ships with the app. Point Claude Desktop at it and
                    shorten links, list them, and pull click analytics from inside a
                    conversation.
                  </p>
                </div>

                <div className="flex flex-none gap-3">
                  <Link href="/mcp" className="btn btn-primary">
                    Read the guide <span className="arrow">→</span>
                  </Link>
                  <Link href="/dashboard" className="btn btn-secondary">
                    Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
