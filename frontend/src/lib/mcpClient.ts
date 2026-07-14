import "server-only";

/**
 * A minimal MCP client, speaking JSON-RPC 2.0 to our own MCP server over HTTP.
 *
 * This file is the piece that makes the chat an *MCP client* rather than a chat
 * bolted onto the app. It talks the same protocol Claude Desktop does, to the
 * same endpoint, with the same tools — so anything that works here works there,
 * and vice versa. If this drifts from Claude Desktop's behaviour, that's a bug in
 * our server, and this is where we'd notice.
 *
 * `server-only` is load-bearing: importing this into a client component becomes a
 * build error rather than a leak. The user's JWT and the MCP URL never reach the
 * browser bundle.
 */

const MCP_URL =
  process.env.MCP_SERVER_URL ?? "http://localhost:3001/mcp";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpError";
  }
}

let nextId = 1;

/**
 * The Streamable HTTP transport may answer as plain JSON *or* as an SSE stream,
 * depending on the request. Both carry the same JSON-RPC envelope, so we accept
 * either rather than assuming one — assuming plain JSON is exactly the bug that
 * makes an MCP client work in curl and fail in the app.
 */
async function rpc<T>(method: string, params: unknown, token: string): Promise<T> {
  let res: Response;

  try {
    res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    });
  } catch {
    throw new McpError(
      "Can't reach the MCP server. Is it running? (cd mcp-server && npm run dev:http)",
    );
  }

  if (!res.ok) {
    throw new McpError(`MCP server returned ${res.status}.`);
  }

  const text = await res.text();

  // SSE frames look like:  event: message\ndata: {...}\n\n
  // Plain JSON is just the object. Pull the last JSON-RPC envelope either way.
  const payload = text
    .split("\n")
    .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line.trim()))
    .filter(Boolean)
    .reduce<unknown>((found, line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === "object" ? parsed : found;
      } catch {
        return found;
      }
    }, null);

  if (!payload) {
    throw new McpError("MCP server sent a response we couldn't parse.");
  }

  const envelope = payload as { result?: T; error?: { message?: string } };

  if (envelope.error) {
    throw new McpError(envelope.error.message ?? "The MCP server rejected the call.");
  }

  return envelope.result as T;
}

export async function listTools(token: string): Promise<McpTool[]> {
  const result = await rpc<{ tools: McpTool[] }>("tools/list", {}, token);
  return result.tools ?? [];
}

/**
 * Calls a tool and flattens the MCP content blocks to a string, because that is
 * all an LLM can consume as a tool result.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  token: string,
): Promise<string> {
  const result = await rpc<{
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>("tools/call", { name, arguments: args }, token);

  const text = (result.content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || "(the tool returned nothing)";
}
