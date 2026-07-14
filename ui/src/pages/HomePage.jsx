import { useState } from "react";
import { Link } from "react-router-dom";
import { createShortUrl } from "../services/apiService";
import Footer from "../components/Footer";

export default function HomePage() {
  const [longUrl, setLongUrl] = useState("");
  const [shortUrlData, setShortUrlData] = useState(null);
  const [serverError, setServerError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateUrl = () => {
    if (!longUrl.trim()) {
      return "URL field cannot be empty.";
    }
    try {
      const u = new URL(longUrl);
      if (!/^https?:$/.test(u.protocol)) return "Please enter a valid URL (e.g., https://example.com).";
    } catch {
      return "Please enter a valid URL (e.g., https://example.com).";
    }
    return "";
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setIsCopied(false);
    setServerError("");
    setShortUrlData(null);
    const err = validateUrl();
    setFieldError(err);
    if (err) return;

    setIsLoading(true);
    try {
      const data = await createShortUrl(longUrl);
      setShortUrlData(data);
    } catch (error) {
      setServerError(error.message || "An unexpected error occurred!");
      setShortUrlData(null);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCopy = async () => {
    if (!shortUrlData?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrlData.shortUrl);
    } catch {}
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <section className="hero container">
        <p className="eyebrow">// free_url_shortener</p>
        <h1>url shortner</h1>
        <p className="lead">
          Enter a long URL, make it short. No account required — sign up later to track every click.
        </p>
      </section>

      <section className="container tool-wrap">
        <div className="tool" data-od-id="shortener-form">
          <h2>Your long URL</h2>
          <p className="sub">
            paste a link, get a short one. we'll save it to your dashboard if you're signed in.
          </p>

          <form id="shorten-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="field">
                <label htmlFor="long-url">your_long_url</label>
                <input
                  id="long-url"
                  className={`input ${fieldError ? "invalid" : ""}`}
                  type="url"
                  placeholder="https://example.com/long/url/to/shorten"
                  autoComplete="off"
                  value={longUrl}
                  onChange={(e) => {
                    setLongUrl(e.target.value);
                    setFieldError("");
                    setServerError("");
                  }}
                />
                <div className="field-error" id="url-error">{fieldError}</div>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                id="shorten-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-sm" /> shortening…
                  </>
                ) : (
                  "shorten"
                )}
              </button>
            </div>
            {serverError && (
              <div className="server-error" role="alert">{serverError}</div>
            )}
          </form>

          {shortUrlData && (
            <div className="result" id="result">
              <h3>Your short URL is ready!</h3>
              <div className="short-url-row">
                <a
                  className="short-url"
                  href={shortUrlData.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shortUrlData.shortUrl}
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  id="copy-btn"
                  onClick={handleCopy}
                >
                  {isCopied ? "copied!" : "copy"}
                </button>
              </div>
              <p className="original-note">
                original: {shortUrlData.longUrl}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="features container">
        <h2>Three things you'll notice in the first ten minutes</h2>
        <div className="features-grid">
          <div className="feature">
            <h3>shorten in one click</h3>
            <p>Paste a long URL, get a short link, copy, share. No signup walls, no captchas on the first paste.</p>
          </div>
          <div className="feature">
            <h3>track every click</h3>
            <p>Sign in to see total clicks and your full link history for every short URL you've created.</p>
          </div>
          <div className="feature">
            <h3>built for AI agents</h3>
            <p>Connect Claude Desktop (or any MCP client) to Trunc and shorten URLs from a conversation.</p>
          </div>
        </div>
      </section>

      <section className="how container">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="num">$ paste</div>
            <h3>Drop in a long URL</h3>
            <p>Any http or https link. We accept what your browser accepts.</p>
          </div>
          <div className="step">
            <div className="num">$ shorten</div>
            <h3>Get a short code</h3>
            <p>An 8-character alias. Optional custom slugs for signed-in users.</p>
          </div>
          <div className="step">
            <div className="num">$ share</div>
            <h3>Watch the clicks roll in</h3>
            <p>Every visit is counted. Sign in to see your link history and per-link click totals.</p>
          </div>
        </div>

        <div className="mcp-banner">
          <div>
            <div className="label">// new</div>
            <h3>
              Connect your AI assistant to Trunc via <Link to="/mcp">MCP →</Link>
            </h3>
          </div>
          <Link to="/mcp" className="btn btn-secondary">read the guide</Link>
        </div>
      </section>

      <Footer meta="free url shortener with analytics" />
    </>
  );
}
