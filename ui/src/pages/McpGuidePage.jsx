import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

const HOSTED_MCP_URL =
  import.meta.env.VITE_HOSTED_MCP_URL ?? "https://trunc-mcp.onrender.com/mcp";
const LOCAL_PATH = "<absolute-path-to>/mcp-server/src/index.ts";

function CodeToken({ kind, children }) {
  return <span className={`code-${kind}`}>{children}</span>;
}

function HostedSnippet({ token }) {
  const authValue = token || "YOUR_AUTH_TOKEN";
  return (
    <pre>
      <CodeToken kind="punct">{"{"}</CodeToken>
      {"\n  "}
      <CodeToken kind="key">"mcpServers"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n    "}
      <CodeToken kind="key">"trunc"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n      "}
      <CodeToken kind="key">"url"</CodeToken>
      <CodeToken kind="punct">:</CodeToken> <CodeToken kind="string">"{HOSTED_MCP_URL}"</CodeToken>
      <CodeToken kind="punct">,</CodeToken>
      {"\n      "}
      <CodeToken kind="key">"headers"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n        "}
      <CodeToken kind="key">"Authorization"</CodeToken>
      <CodeToken kind="punct">:</CodeToken> <CodeToken kind="string">"Bearer {authValue}"</CodeToken>
      {"\n      "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n    "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n  "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n"}
      <CodeToken kind="punct">{"}"}</CodeToken>
    </pre>
  );
}

function LocalSnippet({ token }) {
  const authValue = token || "YOUR_AUTH_TOKEN";
  return (
    <pre>
      <CodeToken kind="punct">{"{"}</CodeToken>
      {"\n  "}
      <CodeToken kind="key">"mcpServers"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n    "}
      <CodeToken kind="key">"trunc"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n      "}
      <CodeToken kind="key">"command"</CodeToken>
      <CodeToken kind="punct">:</CodeToken> <CodeToken kind="string">"npx"</CodeToken>
      <CodeToken kind="punct">,</CodeToken>
      {"\n      "}
      <CodeToken kind="key">"args"</CodeToken>
      <CodeToken kind="punct">: [</CodeToken>
      <CodeToken kind="string">"tsx"</CodeToken>
      <CodeToken kind="punct">,</CodeToken> <CodeToken kind="string">"{LOCAL_PATH}"</CodeToken>
      <CodeToken kind="punct">],</CodeToken>
      {"\n      "}
      <CodeToken kind="key">"env"</CodeToken>
      <CodeToken kind="punct">: {"{"}</CodeToken>
      {"\n        "}
      <CodeToken kind="key">"SHORTENER_API_BASE"</CodeToken>
      <CodeToken kind="punct">:</CodeToken> <CodeToken kind="string">"http://localhost:5000"</CodeToken>
      <CodeToken kind="punct">,</CodeToken>
      {"\n        "}
      <CodeToken kind="key">"TRUNC_MCP_TOKEN"</CodeToken>
      <CodeToken kind="punct">:</CodeToken> <CodeToken kind="string">"{authValue}"</CodeToken>
      {"\n      "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n    "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n  "}
      <CodeToken kind="punct">{"}"}</CodeToken>
      {"\n"}
      <CodeToken kind="punct">{"}"}</CodeToken>
    </pre>
  );
}

function InspectorSnippet() {
  return (
    <pre>
      <CodeToken kind="prompt">$</CodeToken> <CodeToken kind="key">npx</CodeToken> <CodeToken kind="string">@anthropic-ai/mcp-inspector</CodeToken> <CodeToken kind="key">npx</CodeToken> <CodeToken kind="string">tsx</CodeToken> <CodeToken kind="string">{LOCAL_PATH}</CodeToken>
    </pre>
  );
}

function CodeBlock({ id, children }) {
  return (
    <div className="code-block" id={`code-block-${id}`}>
      {children}
    </div>
  );
}

export default function McpGuidePage() {
  const { token, isAuthenticated } = useAuth();
  const isAuth = isAuthenticated && !!token;
  const activeToken = isAuth ? token : null;

  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [copied, setCopied] = useState(null);

  const tokenText = isAuth && tokenRevealed ? activeToken : "•".repeat(48);
  const masked = !isAuth || !tokenRevealed;
  const tokenBtnLabel = !isAuth
    ? "login to generate"
    : !tokenRevealed
    ? "generate"
    : tokenCopied
    ? "copied!"
    : "copy";
  const tokenHint = !isAuth
    ? "login to view your token"
    : !tokenRevealed
    ? "token not yet revealed"
    : tokenCopied
    ? "token copied to clipboard"
    : "token revealed. click copy to put it on the clipboard.";

  async function handleTokenAction() {
    if (!isAuth) return;
    if (!tokenRevealed) {
      setTokenRevealed(true);
      return;
    }
    try { await navigator.clipboard.writeText(activeToken); } catch {}
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  async function handleCopy(kind, text) {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  const snippetToken = isAuth && tokenRevealed ? activeToken : "YOUR_AUTH_TOKEN";
  const hostedText = JSON.stringify(
    {
      mcpServers: {
        trunc: {
          url: HOSTED_MCP_URL,
          headers: { Authorization: "Bearer " + snippetToken },
        },
      },
    },
    null,
    2
  );

  const localText = JSON.stringify(
    {
      mcpServers: {
        trunc: {
          command: "npx",
          args: ["tsx", LOCAL_PATH],
          env: { SHORTENER_API_BASE: "http://localhost:5000", TRUNC_MCP_TOKEN: snippetToken },
        },
      },
    },
    null,
    2
  );

  const inspectorText =
    "npx @anthropic-ai/mcp-inspector npx tsx " + LOCAL_PATH;

  return (
    <>
      <div className="container-narrow">
        <div className="page-head">
          <p className="eyebrow">// model_context_protocol · v1</p>
          <h1>mcp_server</h1>
          <p className="lead">
            Let AI agents use the URL shortener through the Model Context Protocol. Connect Claude Desktop (or any MCP client) in three lines of config.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container-narrow">
          <div className="section-title">
            <h2>your_api_token</h2>
            <p className="sub">
              This JWT is sent in the <code>Authorization: Bearer &lt;token&gt;</code> header by your MCP client.
            </p>
          </div>

          <div className="token-card" data-od-id="token-section">
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Trunc identifies your MCP client with a JWT. Keep it private — anyone with it can create links against your account.
            </p>
            <div className="danger-note">
              // warning — keep this token private; anyone with it can act on your behalf.
            </div>

            <div className={`token-display ${tokenRevealed ? "revealed" : ""}`} id="token-display">
              {tokenText}{" "}
              {masked && (
                <span className="masked-hint">
                  ({isAuth ? "click generate to reveal" : "login first to view"})
                </span>
              )}
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                id="token-action"
                onClick={handleTokenAction}
                disabled={!isAuth}
              >
                {tokenBtnLabel}
              </button>
              <span className="meta" id="token-hint" style={{ alignSelf: "center" }}>
                {tokenHint}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-narrow">
          <div className="section-title">
            <h2>how_to_connect</h2>
            <p className="sub">Pick one of the three options below. Copy the snippet into your client's config.</p>
          </div>

          <div className="option" data-od-id="option-hosted">
            <div className="opt-head">
              <div>
                <span className="opt-num">// option_01 · hosted</span>
                <h3>Hosted (HTTP)</h3>
              </div>
              <button
                className="btn btn-dark btn-tiny copy-btn"
                onClick={() => handleCopy("hosted", hostedText)}
                type="button"
              >
                {copied === "hosted" ? "copied!" : "copy"}
              </button>
            </div>
            <p className="opt-sub">Connect to the public MCP server. Works from any machine.</p>
            <CodeBlock id="hosted">
              <HostedSnippet token={isAuth && tokenRevealed ? activeToken : null} />
            </CodeBlock>
            <p className="anon-hint">
              {!isAuth
                ? <>// login to fill in this snippet with your real JWT.</>
                : !tokenRevealed
                ? <>// click <code>generate</code> above to fill in your real JWT.</>
                : <>// the snippet above uses your real JWT.</>}
            </p>
          </div>

          <div className="option" data-od-id="option-local">
            <div className="opt-head">
              <div>
                <span className="opt-num">// option_02 · local</span>
                <h3>Local (stdio)</h3>
              </div>
              <button
                className="btn btn-dark btn-tiny copy-btn"
                onClick={() => handleCopy("local", localText)}
                type="button"
              >
                {copied === "local" ? "copied!" : "copy"}
              </button>
            </div>
            <p className="opt-sub">
              Runs the MCP server as a local process. Best for development. Requires the backend to be running on <code>localhost:5000</code>.
            </p>
            <CodeBlock id="local">
              <LocalSnippet token={isAuth && tokenRevealed ? activeToken : null} />
            </CodeBlock>
            <p className="anon-hint">
              {!isAuth
                ? <>// login to fill in this snippet with your real JWT.</>
                : !tokenRevealed
                ? <>// click <code>generate</code> above to fill in your real JWT.</>
                : <>// the snippet above uses your real JWT.</>}
            </p>
          </div>

          <div className="option" data-od-id="option-inspector">
            <div className="opt-head">
              <div>
                <span className="opt-num">// option_03 · inspector</span>
                <h3>Test with MCP Inspector</h3>
              </div>
              <button
                className="btn btn-dark btn-tiny copy-btn"
                onClick={() => handleCopy("inspector", inspectorText)}
                type="button"
              >
                {copied === "inspector" ? "copied!" : "copy"}
              </button>
            </div>
            <p className="opt-sub">Spin up the official MCP testing UI to browse and call every tool interactively.</p>
            <CodeBlock id="inspector">
              <InspectorSnippet />
            </CodeBlock>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-narrow">
          <div className="section-title">
            <h2>available_tools</h2>
            <p className="sub">Every tool the Trunc MCP server exposes. Auth column shows whether a JWT is required.</p>
          </div>

          <div data-od-id="tools-table">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>tool</th>
                  <th>auth</th>
                  <th>description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="tool-name">whoami</span></td>
                  <td><span className="auth-pill">—</span></td>
                  <td>Show whether a JWT is currently visible to the MCP server</td>
                </tr>
                <tr>
                  <td><span className="tool-name">shorten_url</span></td>
                  <td><span className="auth-pill required">required</span></td>
                  <td>Shorten a long URL. The new link is attached to the authenticated user's account.</td>
                </tr>
                <tr>
                  <td><span className="tool-name">get_my_links</span></td>
                  <td><span className="auth-pill required">required</span></td>
                  <td>List the authenticated user's links</td>
                </tr>
                <tr>
                  <td><span className="tool-name">get_clicks_by_day</span></td>
                  <td><span className="auth-pill required">required</span></td>
                  <td>Get the authenticated user's click counts aggregated per day over the last N days (1-90, default 30)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer meta="mcp server · 4 tools exposed" />
    </>
  );
}
