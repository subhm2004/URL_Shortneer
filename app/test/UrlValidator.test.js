import assert from "node:assert/strict";
import { describe, it } from "node:test";
import UrlValidator from "../validation/UrlValidator.js";

const validator = new UrlValidator({ baseUrl: "http://localhost:5050" });

const accepts = (url) => validator.validate(url);
const rejects = (url) => assert.throws(() => validator.validate(url));

describe("UrlValidator — the checks the old validUrl.isUri() waved through", () => {
  it("blocks javascript: — stored XSS in any client that renders the link", () => {
    rejects("javascript:alert(1)");
  });

  it("blocks data: URLs", () => {
    rejects("data:text/html,<script>alert(1)</script>");
  });

  it("blocks the cloud metadata endpoint — the classic SSRF target", () => {
    rejects("http://169.254.169.254/latest/meta-data");
  });

  it("blocks loopback and private ranges", () => {
    rejects("http://localhost/admin");
    rejects("http://127.0.0.1:5050/");
    rejects("http://10.0.0.1/");
    rejects("http://192.168.1.1/");
    rejects("http://172.16.0.1/");
  });

  it("blocks non-http protocols", () => {
    rejects("ftp://files.example.com");
    rejects("file:///etc/passwd");
  });

  it("blocks anything unparseable", () => {
    rejects("not a url");
    rejects("");
    rejects("   ");
  });

  it("blocks a link back to our own domain — two of them is a redirect loop", () => {
    rejects("http://localhost:5050/abc123");
  });
});

describe("UrlValidator — the things it must NOT break", () => {
  it("accepts ordinary http and https URLs", () => {
    assert.ok(accepts("https://example.com"));
    assert.ok(accepts("http://example.com/path?q=1#frag"));
    assert.ok(accepts("https://sub.domain.example.com/a/b/c"));
  });

  it("accepts a public IP", () => {
    assert.ok(accepts("http://8.8.8.8/"));
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    assert.equal(accepts("  https://example.com  "), "https://example.com");
  });

  it("rejects a URL longer than the limit", () => {
    rejects("https://example.com/" + "a".repeat(3000));
  });
});
