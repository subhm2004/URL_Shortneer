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
  method?: "GET" | "POST";
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

export async function myLinks(): Promise<ShortUrl[]> {
  const res = await request<ShortUrl[]>("/api/links/my-links", { auth: "required" });
  return res.data ?? [];
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
