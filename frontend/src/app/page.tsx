import Link from "next/link";
import Shortener from "@/components/Shortener";
import Reveal from "@/components/Reveal";

const PROMISES = [
  "No signup to start",
  "Custom aliases",
  "Click analytics",
  "Works with Claude",
];

/**
 * The patterns, grouped by what they *buy you* rather than listed by name.
 *
 * They used to be twelve equal cards, each headed by its pattern name. That
 * ordering is backwards: it asks the reader to already know what a Null Object is
 * before it will tell them why anyone should care. A visitor who doesn't know the
 * jargon learns nothing, and one who does learns nothing new either.
 *
 * So the claim leads, the evidence follows, and the pattern names sit underneath
 * as a footnote for whoever wants them. Same twelve patterns; the reader just
 * isn't made to earn them.
 */
const PILLARS = [
  {
    n: "01",
    claim: "The database never leaks upward",
    body: "Every line of SQL lives behind an interface. No service imports a driver, and none of them knows Postgres is down there at all — which is why moving this app off MongoDB rewrote one directory instead of the whole codebase.",
    patterns: ["repository", "template method", "decorator"],
  },
  {
    n: "02",
    claim: "Swap behaviour, not code",
    body: "Changing how a short code is minted is one environment variable. A different algorithm, a different alphabet, a different length — and not one line of business logic moves. That is the test of whether a seam is real.",
    patterns: ["strategy", "factory", "dependency injection"],
  },
  {
    n: "03",
    claim: "Nothing waits that doesn't have to",
    body: "The redirect answers before the click is ever written down. Every visitor to every link used to sit and wait on our analytics, on the one code path where speed is the entire product. Now none of them do.",
    patterns: ["observer", "singleton", "null object"],
  },
  {
    n: "04",
    claim: "One shape in, one shape out",
    body: "Every URL runs the same six rules before anything is stored. Every response leaves in the same envelope. Every call from the browser goes through one door. Consistency you don't have to remember to keep.",
    patterns: ["chain of responsibility", "builder", "facade"],
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

function Tick() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--matrix)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none opacity-70"
      aria-hidden="true"
    >
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

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

          {/* What the visitor gets — not what it's built with. A logo soup of
              frameworks tells someone deciding whether to paste a link exactly
              nothing; these four lines tell them everything. */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PROMISES.map((promise) => (
              <span
                key={promise}
                className="flex items-center gap-2 text-[13px] text-muted"
              >
                <Tick />
                {promise}
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

          {/* A hairline runs behind the three steps, connecting them — so they read
              as one sequence rather than three unrelated boxes. It's decorative
              only, and hidden once they stack on a narrow screen. */}
          <div className="relative mt-16">
            <span
              className="absolute top-[22px] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent md:block"
              aria-hidden="true"
            />

            <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 90}>
                  <div className="group">
                    <span className="mono grid h-11 w-11 place-items-center rounded-xl bg-surface text-[13px] text-matrix shadow-[var(--ring)] transition-colors group-hover:bg-surface-2">
                      {step.n}
                    </span>
                    <h3 className="mt-6 text-[17px] font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-[38ch] text-[14px] leading-relaxed text-muted">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- assistant */}
      <section id="assistant" className="scroll-mt-20 border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
            <Reveal>
              <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
                Built-in assistant
              </p>
              <h2 className="display max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.75rem)] text-fg">
                Talk to your links.
              </h2>
              <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                Trunc ships a chat that is a genuine MCP client — the same protocol,
                the same server, the same tools Claude Desktop would use. Ask it to
                shorten something, or how your links did this week.
              </p>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                And it doesn&apos;t hide the tool calls. You see exactly what it
                asked for and exactly what came back — because an assistant you
                can&apos;t check is an assistant you can&apos;t trust.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/chat" className="btn btn-primary">
                  Try the assistant <span className="arrow">→</span>
                </Link>
                <Link href="/mcp" className="btn btn-secondary">
                  Use it from Claude
                </Link>
              </div>
            </Reveal>

            {/*
              An illustration of the interaction, not a recording of one. The
              numbers are placeholders — the real thing runs against your own
              account, which is exactly why it can't be shown here.
            */}
            <Reveal delay={90}>
              <div className="card-raised space-y-3 p-6">
                <p className="mono mb-4 text-[10px] tracking-[0.14em] text-faint uppercase">
                  Example
                </p>

                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-xl rounded-br-sm bg-surface-2 px-4 py-2.5 text-[13.5px]">
                    Shorten github.com/subhm2004 and tell me which of my links is
                    doing best
                  </p>
                </div>

                <div className="terminal">
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="mono text-[13px] text-matrix">✓</span>
                    <span className="mono flex-1 text-[13px]">shorten_url</span>
                    <span className="mono text-[11px] text-faint">142ms</span>
                  </div>
                </div>

                <div className="terminal">
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="mono text-[13px] text-matrix">✓</span>
                    <span className="mono flex-1 text-[13px]">get_my_links</span>
                    <span className="mono text-[11px] text-faint">89ms</span>
                  </div>
                </div>

                <p className="pt-2 text-[13.5px] leading-relaxed text-fg-2">
                  Done — it&apos;s at{" "}
                  <span className="mono text-matrix">trunc.sh/x7Kp2mQ1</span>. Your
                  best performer is{" "}
                  <span className="mono text-matrix">/neon-db</span> with 51 clicks,
                  about half of everything you&apos;ve had this month.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- patterns */}
      <section id="patterns" className="scroll-mt-20 border-t border-border py-24">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <div>
                <p className="mono mb-4 text-[11px] tracking-[0.16em] text-matrix uppercase opacity-70">
                  Architecture
                </p>
                <h2 className="display max-w-[16ch] text-[clamp(1.9rem,3.6vw,2.75rem)] text-fg">
                  Twelve patterns. None of them decorative.
                </h2>
              </div>

              <p className="max-w-[54ch] text-[15px] leading-relaxed text-muted">
                Most projects list design patterns like trophies. These are here
                because specific things were unsafe, slow, or impossible to change
                without them — and the code says which. Four of them are below;
                the rest are in the source, with the reasoning next to each one.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-4 md:grid-cols-2">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.n} delay={(i % 2) * 80}>
                <article className="card group flex h-full flex-col p-8 transition-colors hover:bg-surface-2">
                  <span className="mono text-[11px] text-faint">{pillar.n}</span>

                  <h3 className="mt-4 max-w-[22ch] text-[19px] leading-snug font-semibold tracking-[-0.02em]">
                    {pillar.claim}
                  </h3>

                  <p className="mt-4 flex-1 text-[14px] leading-relaxed text-muted">
                    {pillar.body}
                  </p>

                  {/* The pattern names, as a footnote. Whoever wants them will look;
                      whoever doesn't has already got the point. */}
                  <div className="mt-7 flex flex-wrap gap-2 border-t border-border-soft pt-5">
                    {pillar.patterns.map((name) => (
                      <span
                        key={name}
                        className="mono rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-matrix opacity-70 transition-opacity group-hover:opacity-100"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mt-10 flex justify-center">
              <a
                href="https://github.com/subhm2004/URL_Shortneer#design-patterns"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                All twelve, with the code <span className="arrow">→</span>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- final CTA */}
      <section className="border-t border-border py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-9">
          <Reveal>
            <div className="card-raised relative overflow-hidden px-8 py-16 text-center sm:px-14 sm:py-20">
              <div className="grid-bg opacity-60" aria-hidden="true" />
              <div className="spotlight" aria-hidden="true" />

              <div className="relative flex flex-col items-center">
                <h2 className="display display-gradient max-w-[16ch] text-[clamp(2rem,4.4vw,3.4rem)]">
                  Paste a link. Watch it resolve.
                </h2>

                <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed text-muted">
                  Free, no account needed to start. Sign up when you want to see
                  where the clicks are coming from.
                </p>

                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link href="/register" className="btn btn-primary">
                    Get started <span className="arrow">→</span>
                  </Link>
                  <a
                    href="https://github.com/subhm2004/URL_Shortneer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    Read the source
                  </a>
                </div>

                <p className="mono mt-10 text-[11.5px] text-faint">
                  open source · MIT · self-hostable
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
