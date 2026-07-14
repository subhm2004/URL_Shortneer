import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  HomeFlow,
  LoginFlow,
  RegisterFlow,
  DashboardFlow,
  McpFlow,
  PricingFlow,
} from "../components/MiniFlows";

function MiniTopbar({ active, logo, nav }) {
  return (
    <div className="mini-topbar">
      <span>
        <span className="dots">
          <span className={`dot ${active ? "live" : ""}`}></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </span>
        <span className="logo">{logo}</span>
      </span>
      <span className="nav">{nav}</span>
    </div>
  );
}

function MiniStatusStrip({ left, right }) {
  return (
    <div className="mini-status-strip">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export default function OverviewPage() {
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => io.observe(el));
  }, []);

  return (
    <>
      <section className="hero" style={{ textAlign: "left" }}>
        <div className="container">
          <p className="eyebrow reveal">// product_overview · 5 screens</p>
          <h1 className="reveal" style={{ margin: 0 }}>Short links, big insights — for humans and AI agents.</h1>
          <p className="lead reveal" style={{ margin: "var(--space-4) 0 0" }}>
            Trunc is a URL shortener with built-in analytics and a Model Context Protocol server. The five screens below cover the public shortener, account flows, the authenticated dashboard, and the MCP integration guide.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row-between" style={{ marginBottom: 40 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>// screen_inventory</p>
              <h2 style={{ fontSize: "var(--text-2xl)" }}>The five user-facing surfaces</h2>
            </div>
            <Link to="/shorten" className="btn btn-primary">
              open the shortener <span className="arrow">→</span>
            </Link>
          </div>

          <div className="stack-cards reveal-stagger">
            <Link to="/shorten" className="screen-card reveal">
              <div className="frame frame-tall">
                <MiniTopbar active={true} logo="$ trunc.sh" nav="/shorten · /dashboard · /mcp" />
                <div className="mini-hero">
                  <div className="eyebrow">// free_url_shortener</div>
                  <h2>url shortner</h2>
                  <p className="lead">Enter a long URL, make it short. No account required.</p>
                </div>
                <div className="mini-form">
                  <div className="label">your_long_url</div>
                  <div className="input-row">
                    <div className="input"></div>
                    <div className="btn">shorten</div>
                  </div>
                </div>
                <HomeFlow />
              </div>
              <p className="route">/shorten</p>
              <h3>HomePage</h3>
              <p>Public landing + shortener form. Anyone can paste a long URL and get a short link; logged-in users have it saved to their dashboard.</p>
            </Link>

            <Link to="/login" className="screen-card reveal">
              <div className="frame frame-tall">
                <MiniTopbar active={true} logo="$ trunc.sh" nav="/login" />
                <div className="mini-card">
                  <div className="eyebrow">// sign_in</div>
                  <h2>welcome back</h2>
                  <div className="field"><div className="label">your_email</div><div className="input"></div></div>
                  <div className="field"><div className="label">your_password</div><div className="input"></div></div>
                  <div className="btn">sign in</div>
                  <div className="foot">no account? <span style={{ color: "var(--fg)" }}>register</span></div>
                </div>
                <LoginFlow />
                <MiniStatusStrip
                  left={<><span className="live"><span className="pulse"></span>ready</span><span className="sep">·</span>JWT<span className="sep">·</span>24h TTL</>}
                  right="POST /api/auth/login"
                />
              </div>
              <p className="route">/login</p>
              <h3>LoginPage</h3>
              <p>Two-field email + password sign-in. On success, the JWT is stored and the user lands on the dashboard.</p>
            </Link>

            <Link to="/register" className="screen-card reveal">
              <div className="frame frame-tall">
                <MiniTopbar active={true} logo="$ trunc.sh" nav="/register" />
                <div className="mini-card">
                  <div className="eyebrow">// create_account</div>
                  <h2>join trunc.sh</h2>
                  <div className="field"><div className="label">your_name</div><div className="input"></div></div>
                  <div className="field"><div className="label">your_email</div><div className="input"></div></div>
                  <div className="field"><div className="label">your_password</div><div className="input"></div></div>
                  <div className="btn">create account</div>
                  <div className="foot">already a member? <span style={{ color: "var(--fg)" }}>sign in</span></div>
                </div>
                <RegisterFlow />
                <MiniStatusStrip
                  left={<><span className="live"><span className="pulse"></span>secure</span><span className="sep">·</span>argon2id<span className="sep">·</span>zxcvbn</>}
                  right="POST /api/auth/register"
                />
              </div>
              <p className="route">/register</p>
              <h3>RegisterPage</h3>
              <p>Name, email, password. The backend returns a JWT on success — the user is auto-logged in and redirected to the dashboard.</p>
            </Link>

            <Link to="/dashboard" className="screen-card reveal">
              <div className="frame frame-tall">
                <MiniTopbar active={true} logo="$ trunc.sh" nav="logout" />
                <div className="mini-kpis">
                  <div className="kpi"><div className="num">128</div><div className="label">links</div></div>
                  <div className="kpi"><div className="num">4.2k</div><div className="label">clicks</div></div>
                  <div className="kpi"><div className="num">33.5</div><div className="label">avg_ctr</div></div>
                </div>
                <div className="mini-table">
                  <div className="thead"><span>code</span><span>destination</span><span>clicks</span><span>·</span></div>
                  <div className="trow"><span className="tcode">aB12xY9z</span><span className="tdest">example.com/launch…</span><span className="tnum">1,204</span><span className="tcopy">copy</span></div>
                  <div className="trow"><span className="tcode">k7Pq2mN4</span><span className="tdest">github.com/anomaly/…</span><span className="tnum">847</span><span className="tcopy">copy</span></div>
                  <div className="trow"><span className="tcode">Rt5hW8jL</span><span className="tdest">blog.post/scaling…</span><span className="tnum">412</span><span className="tcopy">copy</span></div>
                </div>
                <DashboardFlow />
                <MiniStatusStrip
                  left={<><span className="live"><span className="pulse"></span>realtime</span><span className="sep">·</span>30s sync</>}
                  right="0.4s ago"
                />
              </div>
              <p className="route">/dashboard · auth_required</p>
              <h3>DashboardPage</h3>
              <p>The authenticated user's links. Original URL, short URL, click count, and a Copy action for every row. Protected route.</p>
            </Link>

            <Link to="/mcp" className="screen-card reveal">
              <div className="frame frame-tall">
                <MiniTopbar active={true} logo="$ trunc.sh" nav="copy config" />
                <div className="mini-hero" style={{ padding: "10px 12px 4px" }}>
                  <div className="eyebrow">// mcp_integration</div>
                  <h2>for AI assistants</h2>
                </div>
                <div className="mini-code">
                  <span className="c-grey">$</span> <span className="c-green">"https://trunc.sh/mcp"</span>
                  <br />
                  <span className="c-yellow">Authorization</span>: <span className="c-green">"Bearer eyJ…"</span>
                </div>
                <ul className="mini-tools">
                  <li><span className="tool-name">whoami</span><span className="tool-desc">check auth</span></li>
                  <li><span className="tool-name">shorten_url</span><span className="tool-desc">create link</span></li>
                  <li><span className="tool-name">get_my_links</span><span className="tool-desc">fetch yours</span></li>
                  <li><span className="tool-name">get_clicks_by_day</span><span className="tool-desc">analytics</span></li>
                </ul>
                <McpFlow />
                <MiniStatusStrip
                  left={<><span className="live"><span className="pulse"></span>online</span><span className="sep">·</span>JSON-RPC 2.0<span className="sep">·</span>SSE</>}
                  right="4 tools · 0 prompts"
                />
              </div>
              <p className="route">/mcp</p>
              <h3>McpGuidePage</h3>
              <p>Public guide for connecting Claude Desktop (or any MCP client). Reveals the user's JWT, hosts copy-paste configs, and lists the available tools.</p>
            </Link>

            <div className="screen-card reveal" style={{ background: "var(--surface)" }}>
              <div className="frame frame-tall">
                <MiniTopbar active={false} logo="$ pricing/" nav="3 tiers · planned" />
                <PricingFlow />
                <MiniStatusStrip
                  left={<><span className="sep">·</span>planned<span className="sep">·</span>3 tiers<span className="sep">·</span>self-host ok</>}
                  right="Q3 2026"
                />
              </div>
              <p className="route">/pricing · coming soon</p>
              <h3>Pricing</h3>
              <p>Three tiers — one free and self-hostable, one for power users, one for teams. Final pricing, billing flow, and Stripe integration land in v0.5.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid-2">
            <div>
              <p className="eyebrow">// design_system</p>
              <h2 style={{ fontSize: "var(--text-2xl)" }}>Built on the Mono design system</h2>
            </div>
            <div className="stack" style={{ gap: "var(--space-4)" }}>
              <p className="lead">
                Monochrome ink-on-paper canvas, matrix-inspired accents, IBM Plex Mono for every display and body element. Black accent budget at most twice per screen, ring-based elevation, compact 14px baseline, severe component discipline throughout.
              </p>
              <div className="row" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
                <span className="meta">tokens · 56 declared</span>
                <span className="meta">·</span>
                <span className="meta">type · 1 family</span>
                <span className="meta">·</span>
                <span className="meta">single accent budget</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pagefoot">
        <div className="container row-between">
          <span>© Trunc · 2026</span>
          <span className="meta">mono design system · 5 screens</span>
        </div>
      </footer>
    </>
  );
}
