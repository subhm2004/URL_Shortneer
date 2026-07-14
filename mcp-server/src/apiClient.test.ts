import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  getClicksByDay,
  getMyLinks,
  shortenUrl,
} from "./apiClient.js";

const API_BASE = "http://test-backend";

beforeEach(() => {
  vi.stubEnv("SHORTENER_API_BASE", API_BASE);
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("shortenUrl", () => {
  it("POSTs to /api/shorten with the longUrl and a Bearer token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { success: true, message: "created" }),
    );

    await shortenUrl("https://example.com/long", "jwt-1");

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/shorten`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer jwt-1",
        }),
        body: JSON.stringify({ longUrl: "https://example.com/long" }),
      }),
    );
  });

  it("returns the parsed JSON body on success", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, { success: true, message: "ok" }),
    );
    const res = await shortenUrl("https://example.com", "jwt");
    expect(res).toEqual({ success: true, message: "ok" });
  });
});

describe("getMyLinks", () => {
  it("GETs /api/links/my-links with a Bearer token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, count: 0, data: [] }),
    );
    await getMyLinks("jwt-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/api/links/my-links`);
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-1",
        }),
      }),
    );
  });
});

describe("getClicksByDay", () => {
  it("GETs /api/links/clicks-by-day?days=N with a Bearer token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, count: 0, data: [] }),
    );
    await getClicksByDay(14, "jwt-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/api/links/clicks-by-day?days=14`);
    expect(init).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-1",
        }),
      }),
    );
  });
});

describe("error handling", () => {
  it("throws an ApiError carrying status, body, and message on non-OK responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: "Invalid token" }),
    );

    await expect(shortenUrl("https://example.com", "bad-jwt")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      body: { message: "Invalid token" },
      message: "Invalid token",
    });
  });

  it("falls back to a generic message when the body has no message field", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));

    await expect(shortenUrl("https://example.com", "jwt")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Request failed with 500",
    });
  });

  it("returns undefined for a 2xx with an empty body", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

    const res = await shortenUrl("https://example.com", "jwt");
    expect(res).toBeUndefined();
  });
});
