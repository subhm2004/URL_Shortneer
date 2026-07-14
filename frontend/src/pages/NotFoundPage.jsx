import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Footer from "../components/Footer";

const rows = [
  { code: "aB12xY9z",     status: "302", target: "example.com/launch",         miss: false, cursorDelay: "" },
  { code: "k7Pq2mN4",     status: "404", target: "no such link",               miss: true,  cursorDelay: "delay-1" },
  { code: "Rt5hW8jL",     status: "302", target: "blog.post/scaling",          miss: false, cursorDelay: "delay-2" },
  { code: "launch",       status: "404", target: "deleted 2d ago",              miss: true,  cursorDelay: "delay-3" },
  { code: "v040",         status: "302", target: "github.com/anomaly/…",       miss: false, cursorDelay: "" },
  { code: "/admin/secret", status: "404", target: "not in route table",         miss: true,  cursorDelay: "delay-1" },
  { code: "blogpost",     status: "302", target: "blog.post/release-notes",    miss: false, cursorDelay: "delay-2" },
  { code: ".env",         status: "404", target: "no, not that one",           miss: true,  cursorDelay: "delay-3" },
];

function MarqueeRow({ code, status, target, miss, cursorDelay }) {
  return (
    <span className={`marquee-row ${miss ? "miss" : ""}`}>
      <span>trunc.sh/</span>
      <span className="code">{code}</span>
      <span className="sep">·</span>
      {miss ? (
        <>
          <span className="arrow-miss">{status}</span>
          <span className="sep">·</span>
          <span>{target}</span>
        </>
      ) : (
        <span>{status} → {target}</span>
      )}
      <span className="sep">·</span>
      <span className={`cursor ${cursorDelay}`}></span>
    </span>
  );
}

export default function NotFoundPage() {
  const location = useLocation();
  const triedPath = location.pathname;

  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        targets.forEach((el) => el.classList.add("is-in"));
      });
    });
  }, []);

  return (
    <>
      <section className="section notfound-hero">
        <div className="container">
          <div className="reveal-stagger">
            <p className="eyebrow reveal">// http_404 · route_not_found</p>

            <h1 className="reveal">
              This link doesn&rsquo;t <span className="strike">shorten</span>.
            </h1>

            <p className="correction reveal">
              <span className="prompt">$</span>trunc.route.lookup(<span style={{ color: "var(--fg)" }}>&ldquo;{triedPath}&rdquo;</span>)
              <br />
              <span className="prompt" style={{ marginLeft: 14 }}>↵</span>no matching route · 6 routes served · 0 results
            </p>

            <div className="notfound-marquee reveal" aria-hidden="true">
              <div className="marquee-track">
                {rows.map((row, i) => (
                  <MarqueeRow key={`a-${i}`} {...row} />
                ))}
                {/* duplicate the set so the -50% translate loops seamlessly */}
                {rows.map((row, i) => (
                  <MarqueeRow key={`b-${i}`} {...row} />
                ))}
              </div>
            </div>

            <div className="notfound-ctas reveal">
              <Link to="/" className="btn btn-primary">
                go home <span className="arrow">→</span>
              </Link>
              <Link to="/shorten" className="btn btn-ghost">
                try a shortener <span className="arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer meta="mono design system · 5 screens · 1 utility" />
    </>
  );
}
