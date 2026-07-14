import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createShortUrl } from "../services/apiService";
import Pipeline from "../components/Pipeline";
import Footer from "../components/Footer";

const PATTERNS = [
  { n: "01", name: "Singleton", where: "config · pool · logger", why: "One Postgres pool for the process. A pool per request would exhaust the connection limit." },
  { n: "02", name: "Repository", where: "User · Url · Click", why: "SQL lives behind an interface, so the services never import a driver." },
  { n: "03", name: "Template Method", where: "BaseRepository", why: "Subclasses declare the table; they inherit the query and transaction plumbing." },
  { n: "04", name: "Decorator", where: "CachedUrlRepository", why: "Adds caching to the redirect lookup without a single service knowing it exists." },
  { n: "05", name: "Null Object", where: "NullCache", why: "Turning the cache off is an injection, not a codebase full of null checks." },
  { n: "06", name: "Strategy", where: "NanoId · Base62 · Alias", why: "Swap how codes are minted with an env var. No service code moves." },
  { n: "07", name: "Factory", where: "ShortCodeStrategyFactory", why: "The one place that knows the concrete strategy classes by name." },
  { n: "08", name: "Chain of Responsibility", where: "UrlValidator", why: "Each rule rejects or passes along. Order is configuration, not control flow." },
  { n: "09", name: "Observer", where: "EventBus", why: "The redirect answers immediately; clicks are recorded on the next tick." },
  { n: "10", name: "Builder", where: "ApiResponse", why: "One response envelope, decided once, instead of five that drifted apart." },
  { n: "11", name: "Dependency Injection", where: "container.js", why: "Everything takes its collaborators in. That's what makes it testable." },
  { n: "12", name: "Facade", where: "HttpClient", why: "Three UI service files repeated the same fetch/error dance. Now they don't." },
];

const RECEIPTS = [
  {
    claim: "50 concurrent clicks → 51 counted",
    detail: "An atomic UPDATE … SET click_count = click_count + 1. The read-modify-write it replaced dropped increments under load.",
  },
  {
    claim: "javascript: and 169.254.169.254 rejected",
    detail: "The protocol allowlist and private-host rule. A shortener without them is an XSS vector and an SSRF gadget.",
  },
  {
    claim: "Clicks aggregated in Postgres",
    detail: "generate_series joins a date spine, so empty days come back as zero. The old version pulled every click into Node and counted them in a Map.",
  },
  {
    claim: "urls.url_code is UNIQUE",
    detail: "It's the redirect key. Without the constraint, two links could collide and one would send visitors to the wrong site.",
  },
];

export default function LandingPage() {
  const [longUrl, setLongUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [latencyMs, setLatencyMs] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  // Bumped on every submit and used as Pipeline's key, so each run remounts it
  // and its stage reveal starts from zero — instead of Pipeline resetting itself
  // with a setState inside an effect.
  const [runId, setRunId] = useState(0);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Scroll-reveal for the sections below the fold.
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!longUrl.trim() || state === "loading") return;

    setRunId((n) => n + 1);
    setState("loading");
    setError("");
    setResult(null);
    setCopied(false);

    const started = performance.now();
    try {
      const url = await createShortUrl(longUrl.trim());
      setLatencyMs(Math.round(performance.now() - started));
      setResult(url);
      setState("done");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setState("error");
    }
  }

  async function handleCopy() {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
    } catch {
      return; // clipboard blocked (insecure origin) — say nothing rather than lie
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* ---------- hero: the tool IS the hero ---------- */}
      <section className="lp-hero">
        <div className="lp-grid-bg" aria-hidden="true" />
        <div className="container">
          <p className="eyebrow lp-eyebrow">
            <span className="lp-dot" /> url shortener · postgres · 12 design patterns
          </p>

          <h1 className="lp-title">
            Shorten a link.
            <br />
            <span className="lp-title-dim">Watch the architecture</span>{" "}
            <span className="lp-title-mark">run.</span>
          </h1>

          <p className="lead lp-lead">
            Most shorteners hide the machinery. This one shows it to you — paste a
            URL and every layer it passes through lights up, in order, as the real
            request runs.
          </p>

          <form className="lp-form" onSubmit={handleSubmit} noValidate>
            <div className="lp-input-wrap">
              <span className="lp-input-prompt" aria-hidden="true">
                $
              </span>
              <input
                className="lp-input"
                type="url"
                inputMode="url"
                placeholder="https://your-very-long-url.example.com/path?utm=…"
                aria-label="URL to shorten"
                value={longUrl}
                onChange={(e) => {
                  setLongUrl(e.target.value);
                  if (state === "error") setState("idle");
                }}
              />
            </div>
            <button
              className="btn btn-primary lp-submit"
              type="submit"
              disabled={state === "loading" || !longUrl.trim()}
            >
              {state === "loading" ? (
                <>
                  <span className="spinner-sm" /> shortening
                </>
              ) : (
                <>
                  shorten <span className="arrow">→</span>
                </>
              )}
            </button>
          </form>

          <Pipeline
            key={runId}
            state={state}
            latencyMs={latencyMs}
            code={result?.urlCode}
            error={error}
          />

          {result && (
            <div className="lp-result">
              <a
                className="lp-result-url"
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.shortUrl}
              </a>
              <button className="btn btn-secondary btn-tiny" onClick={handleCopy} type="button">
                {copied ? "copied" : "copy"}
              </button>
              <span className="lp-result-note">
                not signed in? this link still works — <Link to="/register">create an account</Link> to
                track its clicks.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ---------- patterns ---------- */}
      <section className="section lp-patterns">
        <div className="container">
          <div className="lp-section-head reveal">
            <p className="eyebrow">// the_twelve</p>
            <h2>Every pattern here earns its place</h2>
            <p className="lead">
              None of these were added to pad a list. Each one is here because
              something in this codebase was hard to change, unsafe, or slow
              without it — the third column says which.
            </p>
          </div>

          <div className="lp-pattern-grid reveal-stagger">
            {PATTERNS.map((p) => (
              <article className="lp-pattern reveal" key={p.n}>
                <div className="lp-pattern-top">
                  <span className="lp-pattern-n">{p.n}</span>
                  <h3>{p.name}</h3>
                </div>
                <p className="lp-pattern-where">{p.where}</p>
                <p className="lp-pattern-why">{p.why}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- receipts ---------- */}
      <section className="section lp-receipts">
        <div className="container">
          <div className="lp-section-head reveal">
            <p className="eyebrow">// receipts</p>
            <h2>Four bugs the rewrite actually fixed</h2>
            <p className="lead">
              Patterns are the means. These are the ends — each one verified against
              a live Postgres, not asserted in a README.
            </p>
          </div>

          <div className="lp-receipt-list reveal-stagger">
            {RECEIPTS.map((r) => (
              <div className="lp-receipt reveal" key={r.claim}>
                <span className="lp-receipt-mark" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <h3>{r.claim}</h3>
                  <p>{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- mcp ---------- */}
      <section className="section lp-mcp">
        <div className="container">
          <div className="lp-mcp-inner reveal">
            <div>
              <p className="eyebrow">// also_for_agents</p>
              <h2>Your AI assistant can use it too</h2>
              <p className="lead">
                An MCP server ships with the app. Point Claude Desktop at it and
                shorten links, list them, and pull click analytics from inside a
                conversation.
              </p>
              <div className="lp-mcp-ctas">
                <Link to="/mcp" className="btn btn-primary">
                  read the guide <span className="arrow">→</span>
                </Link>
                <Link to="/dashboard" className="btn btn-secondary">
                  open dashboard
                </Link>
              </div>
            </div>

            <div className="lp-mcp-code">
              <div className="lp-mcp-code-bar">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="lp-mcp-code-name">claude_desktop_config.json</span>
              </div>
              <pre>
                <code>
                  <span className="code-punct">{"{"}</span>
                  {"\n  "}
                  <span className="code-key">"trunc"</span>
                  <span className="code-punct">: {"{"}</span>
                  {"\n    "}
                  <span className="code-key">"url"</span>
                  <span className="code-punct">: </span>
                  <span className="code-string">"http://localhost/mcp"</span>
                  <span className="code-punct">,</span>
                  {"\n    "}
                  <span className="code-key">"headers"</span>
                  <span className="code-punct">: {"{"}</span>
                  {"\n      "}
                  <span className="code-key">"Authorization"</span>
                  <span className="code-punct">: </span>
                  <span className="code-string">"Bearer &lt;your-jwt&gt;"</span>
                  {"\n    "}
                  <span className="code-punct">{"}"}</span>
                  {"\n  "}
                  <span className="code-punct">{"}"}</span>
                  {"\n"}
                  <span className="code-punct">{"}"}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <Footer meta="postgres · express · react · mcp" />
    </>
  );
}
