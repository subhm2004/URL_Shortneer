import { tokenStore } from "./tokenStore";
import type {
  ApiEnvelope,
  AuthResult,
  DayCount,
  Overview,
  ShortUrl,
  User,
} from "./types";

/**
 * Facade — one entry point for every call to the backend.
 *
 * Without it, each feature re-implements the same twenty lines: build the URL,
 * set Content-Type, attach the bearer token, parse JSON, check res.ok, throw
 * something. That duplication doesn't just bloat — it *drifts*. In the previous
 * frontend, two of the three service files sent the auth token and one didn't,
 * and each had invented its own fallback error message.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The token is missing or expired; the user needs to sign in again. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

/**
 * Empty in dev: next.config.ts rewrites /api to the backend, so requests are
 * same-origin and never trigger a CORS preflight. In production this is the
 * Render URL, and the backend allows the Vercel origin explicitly.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/** "required" fails fast without a token; "optional" sends one if we have it. */
type Auth = "required" | "optional" | "none";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: Auth;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  { method = "GET", body, auth = "optional", signal }: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth !== "none") {
    const token = tokenStore.get();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (auth === "required") {
      throw new ApiError("You need to sign in first.", 401);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    // fetch only rejects on a network failure — a 500 resolves normally.
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }

  const text = await res.text();
  let payload: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      payload = { success: false, message: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(
      payload?.message ?? `Request failed (${res.status})`,
      res.status,
      payload,
    );
  }

  return payload ?? { success: true };
}

/* ---------------------------------------------------------------------------
   auth — "none", because a stale token must not ride along with a login attempt
   --------------------------------------------------------------------------- */

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const res = await request<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: input,
    auth: "none",
  });
  return { token: res.token!, user: res.data!.user };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const res = await request<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: input,
    auth: "none",
  });
  return { token: res.token!, user: res.data!.user };
}

/** The signed-in user's own record. The JWT carries only an id. */
export async function me(): Promise<User> {
  const res = await request<{ user: User }>("/api/auth/me", { auth: "required" });
  return res.data!.user;
}

export interface Providers {
  password: boolean;
  google: boolean;
}

/**
 * Which sign-in methods the backend actually has configured.
 *
 * Asked rather than assumed: with no Google credentials set, the backend doesn't
 * mount those routes, and a hardcoded button would render happily and then 404
 * when clicked.
 *
 * This deliberately does NOT swallow a failure. It used to — returning
 * `{ google: false }` when the backend was unreachable — and that made a dead
 * backend look exactly like a backend with no Google credentials: the button
 * silently vanished either way. Two unrelated problems, one identical symptom,
 * and no way to tell them apart. The caller has to know the difference.
 */
export async function providers(): Promise<Providers> {
  const res = await request<Providers>("/api/auth/providers", { auth: "none" });
  return res.data ?? { password: true, google: false };
}

/**
 * Starts the OAuth flow as a full-page navigation, not a fetch.
 *
 * It has to be: Google's consent screen is a page the user must actually see and
 * interact with. An XHR to it would be blocked, and there'd be nothing to show.
 */
export function startGoogleSignIn(): void {
  window.location.href = `${BASE}/api/auth/google`;
}

/* ---------------------------------------------------------------------------
   links
   --------------------------------------------------------------------------- */

export interface ShortenResult {
  url: ShortUrl;
  /** false when the backend returned a link you'd already created. */
  created: boolean;
}

/** Anonymous shortening is a feature, so auth is optional here, not required. */
export async function shorten(
  longUrl: string,
  customAlias?: string,
): Promise<ShortenResult> {
  const res = await request<{ url: ShortUrl }>("/api/shorten", {
    method: "POST",
    body: { longUrl, ...(customAlias ? { customAlias } : {}) },
    auth: "optional",
  });

  // The backend answers 201 for a new link and 200 for one that already existed.
  // We can't read the status here, so the message carries it.
  return {
    url: res.data!.url,
    created: res.message?.includes("created") ?? true,
  };
}

export interface LinkPage {
  links: ShortUrl[];
  /** Opaque. Pass it back to fetch the next page; null means there isn't one. */
  nextCursor: string | null;
}

/**
 * One page of links.
 *
 * The cursor is opaque on purpose — it encodes (created_at, id), but decoding it
 * here would couple the client to the server's pagination scheme and freeze it
 * forever. We pass it back exactly as we received it.
 */
export async function myLinks(
  { limit = 20, cursor }: { limit?: number; cursor?: string | null } = {},
): Promise<LinkPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);

  const res = await request<ShortUrl[]>(
    `/api/links/my-links?${params}`,
    { auth: "required" },
  );

  return {
    links: res.data ?? [],
    nextCursor: (res as { nextCursor?: string | null }).nextCursor ?? null,
  };
}

/** Deletes a link. The backend answers 404 — never 403 — for someone else's. */
export async function deleteLink(urlCode: string): Promise<void> {
  await request(`/api/links/${encodeURIComponent(urlCode)}`, {
    method: "DELETE",
    auth: "required",
  });
}

/**
 * Repoints a link at a new destination. The short code doesn't change — that is
 * the point: everyone who already has the link keeps working.
 */
export async function repointLink(
  urlCode: string,
  longUrl: string,
): Promise<ShortUrl> {
  const res = await request<{ url: ShortUrl }>(
    `/api/links/${encodeURIComponent(urlCode)}`,
    { method: "PATCH", body: { longUrl }, auth: "required" },
  );
  return res.data!.url;
}

export async function clicksByDay(days = 30): Promise<DayCount[]> {
  const res = await request<DayCount[]>(`/api/links/clicks-by-day?days=${days}`, {
    auth: "required",
  });
  return res.data ?? [];
}

export async function overview(): Promise<Overview> {
  const res = await request<Overview>("/api/links/overview", { auth: "required" });
  return res.data!;
}
