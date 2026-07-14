import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./authContext.js", () => ({
  getToken: vi.fn(),
}));

vi.mock("./apiClient.js", async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    ApiError,
    shortenUrl: vi.fn(),
    getMyLinks: vi.fn(),
    getClicksByDay: vi.fn(),
  };
});

import { getToken } from "./authContext.js";
import { getClicksByDay, getMyLinks, shortenUrl, ApiError } from "./apiClient.js";
import {
  handleGetClicksByDay,
  handleGetMyLinks,
  handleShortenUrl,
  handleWhoami,
} from "./tools.js";

const mockGetToken = vi.mocked(getToken);
const mockShortenUrl = vi.mocked(shortenUrl);
const mockGetMyLinks = vi.mocked(getMyLinks);
const mockGetClicksByDay = vi.mocked(getClicksByDay);

const NO_AUTH_MSG =
  "Not authenticated. For HTTP, send Authorization: Bearer <jwt>. For stdio, set the TRUNC_MCP_TOKEN env var.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleWhoami", () => {
  it("returns 'Not authenticated' when no token", async () => {
    mockGetToken.mockReturnValue(undefined);
    const res = await handleWhoami();
    expect(res).toEqual({
      content: [{ type: "text", text: "Not authenticated" }],
    });
  });

  it("returns 'Authenticated' when a token is present", async () => {
    mockGetToken.mockReturnValue("some-jwt");
    const res = await handleWhoami();
    expect(res).toEqual({
      content: [{ type: "text", text: "Authenticated" }],
    });
  });
});

describe("handleShortenUrl", () => {
  it("returns no-auth message when no token", async () => {
    mockGetToken.mockReturnValue(undefined);
    const res = await handleShortenUrl({ longUrl: "https://example.com" });
    expect(res).toEqual({ content: [{ type: "text", text: NO_AUTH_MSG }] });
    expect(mockShortenUrl).not.toHaveBeenCalled();
  });

  it("calls the API with the token and formats the URL on success", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockShortenUrl.mockResolvedValue({
      success: true,
      message: "ok",
      data: {
        url: {
          id: "abc",
          urlCode: "aB12",
          longUrl: "https://example.com/long",
          shortUrl: "https://trunc.sh/aB12",
          clickCount: 3,
          createdAt: "2026-06-26T00:00:00.000Z",
          userId: "u1",
        },
      },
    });
    const res = await handleShortenUrl({ longUrl: "https://example.com/long" });
    expect(mockShortenUrl).toHaveBeenCalledWith(
      "https://example.com/long",
      "jwt",
      undefined, // no customAlias supplied
    );
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("code: aB12");
    expect(text).toContain("short: https://trunc.sh/aB12");
    expect(text).toContain("clicks: 3");
  });

  it("falls back to the API message when no payload is returned", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockShortenUrl.mockResolvedValue({
      success: true,
      message: "Created (no body)",
    });
    const res = await handleShortenUrl({ longUrl: "https://example.com" });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("Created (no body)");
  });

  it("wraps ApiError as readable text", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockShortenUrl.mockRejectedValue(new ApiError(401, { message: "no" }, "Unauthorized"));
    const res = await handleShortenUrl({ longUrl: "https://example.com" });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("API error 401");
    expect(text).toContain("Unauthorized");
  });

  it("wraps unknown errors", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockShortenUrl.mockRejectedValue(new Error("boom"));
    const res = await handleShortenUrl({ longUrl: "https://example.com" });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("Unexpected error: boom");
  });
});

describe("handleGetMyLinks", () => {
  it("returns no-auth message when no token", async () => {
    mockGetToken.mockReturnValue(undefined);
    const res = await handleGetMyLinks();
    expect(res).toEqual({ content: [{ type: "text", text: NO_AUTH_MSG }] });
    expect(mockGetMyLinks).not.toHaveBeenCalled();
  });

  it("returns 'No links found' when data is empty", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetMyLinks.mockResolvedValue({ success: true, count: 0, data: [] });
    const res = await handleGetMyLinks();
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("No links found for this user.");
  });

  it("formats a list of links", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetMyLinks.mockResolvedValue({
      success: true,
      count: 2,
      data: [
        {
          id: "1",
          urlCode: "aB12",
          longUrl: "https://a.com",
          shortUrl: "https://trunc.sh/aB12",
          clickCount: 1,
          createdAt: "2026-06-26T00:00:00.000Z",
          userId: "u1",
        },
        {
          id: "2",
          urlCode: "xY34",
          longUrl: "https://b.com",
          shortUrl: "https://trunc.sh/xY34",
          clickCount: 7,
          createdAt: "2026-06-25T00:00:00.000Z",
          userId: "u1",
        },
      ],
    });
    const res = await handleGetMyLinks();
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("2 link(s):");
    expect(text).toContain("code: aB12");
    expect(text).toContain("code: xY34");
    expect(text).toContain("clicks: 7");
  });

  it("wraps ApiError as readable text", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetMyLinks.mockRejectedValue(new ApiError(500, null, "Internal server error"));
    const res = await handleGetMyLinks();
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("API error 500");
  });
});

describe("handleGetClicksByDay", () => {
  it("returns no-auth message when no token", async () => {
    mockGetToken.mockReturnValue(undefined);
    const res = await handleGetClicksByDay({ days: 7 });
    expect(res).toEqual({ content: [{ type: "text", text: NO_AUTH_MSG }] });
    expect(mockGetClicksByDay).not.toHaveBeenCalled();
  });

  it("defaults days to 30 when omitted", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetClicksByDay.mockResolvedValue({
      success: true,
      count: 0,
      data: [],
    });
    await handleGetClicksByDay();
    expect(mockGetClicksByDay).toHaveBeenCalledWith(30, "jwt");
  });

  it("passes the requested days value through", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetClicksByDay.mockResolvedValue({
      success: true,
      count: 0,
      data: [],
    });
    await handleGetClicksByDay({ days: 7 });
    expect(mockGetClicksByDay).toHaveBeenCalledWith(7, "jwt");
  });

  it("returns 'No click data' when data is empty", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetClicksByDay.mockResolvedValue({
      success: true,
      count: 0,
      data: [],
    });
    const res = await handleGetClicksByDay({ days: 7 });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("No click data for this period.");
  });

  it("formats click data as date: count lines", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetClicksByDay.mockResolvedValue({
      success: true,
      count: 2,
      data: [
        { date: "2026-06-25", count: 4 },
        { date: "2026-06-26", count: 11 },
      ],
    });
    const res = await handleGetClicksByDay({ days: 7 });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Clicks per day (2 day(s)):");
    expect(text).toContain("2026-06-25: 4");
    expect(text).toContain("2026-06-26: 11");
  });

  it("wraps ApiError as readable text", async () => {
    mockGetToken.mockReturnValue("jwt");
    mockGetClicksByDay.mockRejectedValue(new ApiError(403, { message: "no" }, "Forbidden"));
    const res = await handleGetClicksByDay({ days: 7 });
    const text = (res.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("API error 403");
  });
});
