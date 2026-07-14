function getApiBase(): string {
  return process.env.SHORTENER_API_BASE ?? "http://localhost:5000";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Request failed with ${res.status}`;
    throw new ApiError(res.status, body, message);
  }

  return body as T;
}

export interface ShortenResponse {
  success: boolean;
  message: string;
  data?: { url: ShortUrl };
}

export interface ShortUrl {
  id: string;
  urlCode: string;
  longUrl: string;
  shortUrl: string;
  clickCount: number;
  createdAt: string;
  userId?: string | null;
}

export interface MyLinksResponse {
  success: boolean;
  count: number;
  data: ShortUrl[];
}

export interface ClicksByDayResponse {
  success: boolean;
  count: number;
  data: Array<{ date: string; count: number }>;
}

export function shortenUrl(longUrl: string, token: string, customAlias?: string) {
  return request<ShortenResponse>("/api/shorten", {
    method: "POST",
    body: JSON.stringify({ longUrl, ...(customAlias ? { customAlias } : {}) }),
    token,
  });
}

export function getMyLinks(token: string) {
  return request<MyLinksResponse>("/api/links/my-links", { token });
}

export function getClicksByDay(days: number, token: string) {
  return request<ClicksByDayResponse>(
    `/api/links/clicks-by-day?days=${days}`,
    { token },
  );
}
