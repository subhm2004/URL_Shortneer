import tokenStore from "./tokenStore.js";

/**
 * Facade — one entry point for every call to the backend.
 *
 * The three service files each used to repeat the same twenty lines: build the
 * URL, set Content-Type, attach the bearer token, `await res.json()`, check
 * `res.ok`, throw `new Error(data.message || "...")`, console.error, rethrow.
 * They had already drifted (only two of them sent the token; each invented its
 * own fallback message). Concentrating it here means a change to auth or error
 * handling is one edit, not three.
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  /** True when the token is missing/expired and the user should re-authenticate. */
  get isAuthError() {
    return this.status === 401;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || "";

class HttpClient {
  #baseUrl;
  #tokens;

  constructor({ baseUrl = BASE_URL, tokens = tokenStore } = {}) {
    this.#baseUrl = baseUrl;
    this.#tokens = tokens;
  }

  async #request(method, path, { body, auth = "optional", signal } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";

    // auth: "required" → send the token, fail fast if we don't have one.
    //       "optional" → send it if we have one (anonymous shortening still works).
    //       "none"     → never send it (login/register).
    if (auth !== "none") {
      const token = this.#tokens.get();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      } else if (auth === "required") {
        throw new ApiError("You need to sign in first.", 401, null);
      }
    }

    let response;
    try {
      response = await fetch(`${this.#baseUrl}${path}`, {
        method,
        headers,
        signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      // fetch only rejects on network failure — a 500 is a resolved promise.
      throw new ApiError("Can't reach the server. Check your connection.", 0, null);
    }

    // 204 and friends have no body to parse.
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.message || `Request failed (${response.status})`,
        response.status,
        payload,
      );
    }

    return payload;
  }

  get(path, options) {
    return this.#request("GET", path, options);
  }

  post(path, body, options) {
    return this.#request("POST", path, { ...options, body });
  }
}

export default new HttpClient();
