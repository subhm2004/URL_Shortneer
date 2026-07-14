import http from "./HttpClient.js";

/**
 * Anonymous shortening is allowed, so auth is "optional": the token is attached
 * when the user happens to be signed in, and the link lands in their dashboard.
 */
export async function createShortUrl(longUrl, { customAlias } = {}) {
  const payload = await http.post(
    "/api/shorten",
    { longUrl, ...(customAlias ? { customAlias } : {}) },
    { auth: "optional" },
  );
  return payload.data.url;
}
