import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ApiError,
  getClicksByDay,
  getMyLinks,
  shortenUrl,
  type ShortUrl,
} from "./apiClient.js";
import { getToken } from "./authContext.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function formatUrl(url: ShortUrl): string {
  return [
    `code: ${url.urlCode}`,
    `short: ${url.shortUrl}`,
    `long:  ${url.longUrl}`,
    `clicks: ${url.clickCount}`,
    `created: ${new Date(url.createdAt).toISOString()}`,
  ].join("\n");
}

function handleApiError(err: unknown): ReturnType<typeof textResult> {
  if (err instanceof ApiError) {
    const body = err.body !== undefined ? ` — ${JSON.stringify(err.body)}` : "";
    return textResult(`API error ${err.status}: ${err.message}${body}`);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return textResult(`Unexpected error: ${msg}`);
}

const NO_AUTH_MSG =
  "Not authenticated. For HTTP, send Authorization: Bearer <jwt>. For stdio, set the TRUNC_MCP_TOKEN env var.";

export async function handleWhoami() {
  return textResult(getToken() ? "Authenticated" : "Not authenticated");
}

export async function handleShortenUrl({
  longUrl,
  customAlias,
}: {
  longUrl: string;
  customAlias?: string;
}) {
  const token = getToken();
  if (!token) return textResult(NO_AUTH_MSG);
  try {
    const res = await shortenUrl(longUrl, token, customAlias);
    if (res.data?.url) {
      return textResult(formatUrl(res.data.url));
    }
    return textResult(res.message ?? "URL shortened (no payload returned)");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function handleGetMyLinks() {
  const token = getToken();
  if (!token) return textResult(NO_AUTH_MSG);
  try {
    const res = await getMyLinks(token);
    if (!res.data?.length) {
      return textResult("No links found for this user.");
    }
    return textResult(
      `${res.count} link(s):\n\n` + res.data.map(formatUrl).join("\n\n"),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function handleGetClicksByDay(
  args: { days?: number } = {},
) {
  const token = getToken();
  if (!token) return textResult(NO_AUTH_MSG);
  try {
    const res = await getClicksByDay(args.days ?? 30, token);
    if (!res.data?.length) {
      return textResult("No click data for this period.");
    }
    const lines = res.data.map(
      ({ date, count }) => `${date}: ${count}`,
    );
    return textResult(
      `Clicks per day (${res.count} day(s)):\n\n` + lines.join("\n"),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export function createServer() {
  const server = new McpServer({
    name: "trunc",
    version: "0.3.0",
  });

  server.registerTool(
    "whoami",
    {
      description:
        "Show whether a JWT is currently visible to the MCP server. Reads the Authorization header (HTTP) or the TRUNC_MCP_TOKEN env var (stdio).",
      inputSchema: z.object({}),
    },
    handleWhoami,
  );

  server.registerTool(
    "shorten_url",
    {
      description:
        "Create a short URL attached to the authenticated user's account. Requires a JWT (Authorization header on HTTP, TRUNC_MCP_TOKEN env var on stdio).",
      inputSchema: z.object({
        longUrl: z
          .string()
          .url()
          .describe("The long URL to shorten, e.g. https://example.com/very/long"),
        customAlias: z
          .string()
          .regex(/^[a-zA-Z0-9_-]{3,32}$/)
          .optional()
          .describe(
            "Optional custom slug (3-32 chars: letters, numbers, - and _). Fails with a 409 if already taken.",
          ),
      }),
    },
    handleShortenUrl,
  );

  server.registerTool(
    "get_my_links",
    {
      description: "List the short URLs created by the authenticated user. Requires a JWT.",
      inputSchema: z.object({}),
    },
    handleGetMyLinks,
  );

  server.registerTool(
    "get_clicks_by_day",
    {
      description:
        "Get the authenticated user's click counts aggregated per day over the last N days (1-90, default 30). Requires a JWT.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .optional()
          .describe("Number of days to include (1-90, default 30)"),
      }),
    },
    handleGetClicksByDay,
  );

  return server;
}
