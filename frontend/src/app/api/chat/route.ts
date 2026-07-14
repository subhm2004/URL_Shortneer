import { NextResponse } from "next/server";
import { callTool, listTools, McpError } from "@/lib/mcpClient";

/**
 * The chat agent. Runs entirely on the server, and that is the point:
 *
 *   GROQ_API_KEY has no NEXT_PUBLIC_ prefix, so Next refuses to inline it into
 *   the client bundle. If it were exposed, anyone could open DevTools, lift it,
 *   and spend the owner's quota. The browser never sees it, and never sees the
 *   MCP server's address either.
 *
 * What this actually is: an MCP *client*. It asks our MCP server what tools
 * exist, hands that list to Groq, and executes whatever Groq decides to call —
 * the same protocol, the same endpoint, the same tools Claude Desktop uses. The
 * model is swappable; the tool surface is not.
 */

/**
 * Vercel kills a serverless function at 10 seconds by default. This one has to
 * wait on Groq, then on the MCP server, then on Groq again — and if the MCP
 * server is on a free Render tier it may be cold, which alone costs ~50s.
 *
 * The default would sever the request mid-flight and the user would see a generic
 * failure with nothing to debug.
 */
export const maxDuration = 60;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Good at tool calling, and fast enough that the round-trip doesn't drag. */
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

/**
 * A model that keeps calling tools forever would keep spending tokens forever.
 * Four rounds is plenty for "shorten this and show me my stats" — two tools with
 * room to recover from a mistake — and it bounds the cost of a bad prompt.
 */
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `You are Trunc's assistant. Trunc is a URL shortener with click analytics.

You have tools that operate on the signed-in user's real account. Use them — never invent a short link, a click count, or a statistic. If a tool fails, say what failed; do not guess at what it would have returned.

Be brief. One or two sentences unless the user asks for detail. When you shorten a URL, give back the short link. When you report analytics, give the actual numbers the tool returned.`;

interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** What the UI renders in the trace — the whole reason this isn't a black box. */
export interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  result: string;
  ms: number;
  failed: boolean;
}

/**
 * Normalises the arguments the model sends into an object — always.
 *
 * For a tool that takes no arguments, Groq sends the *string* "null" (and
 * sometimes "" or nothing at all). Parsing that gives `null`, and forwarding it
 * to the MCP server produces `arguments: null`, which its Zod schema rejects with
 * `expected: "record"`.
 *
 * The effect was that every zero-argument tool — whoami, get_my_links — could
 * never be called successfully. Half the tool surface, silently unusable, and the
 * model would just keep retrying until it ran out of rounds.
 */
function parseToolArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  const isPlainObject =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);

  return isPlainObject ? (parsed as Record<string, unknown>) : {};
}

async function askGroq(messages: GroqMessage[], tools: unknown[], apiKey: string) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.3, // this is a tool-driver, not a poet
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Surface Groq's own reason (bad key, rate limit, unknown model) rather than
    // a generic 500 — those three are the only things that realistically go wrong
    // here, and each has a different fix.
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message as GroqMessage | undefined;
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat isn't configured — GROQ_API_KEY is missing on the server." },
      { status: 503 },
    );
  }

  // Every MCP tool requires the user's JWT. The chat can't be anonymous, because
  // "my links" is meaningless without knowing whose.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json(
      { error: "Sign in first — the tools act on your own account." },
      { status: 401 },
    );
  }

  let body: { messages?: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const history = (body.messages ?? []).slice(-12); // keep the context bounded
  if (history.length === 0) {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });
  }

  try {
    // Ask the MCP server what it can do, rather than hardcoding a tool list here.
    // Add a tool to mcp-server/src/tools.ts and it shows up in this chat with no
    // change to this file.
    const mcpTools = await listTools(token);

    const groqTools = mcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.inputSchema ?? { type: "object", properties: {} },
      },
    }));

    const messages: GroqMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const trace: ToolTrace[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await askGroq(messages, groqTools, apiKey);

      if (!reply) {
        return NextResponse.json({ error: "Groq returned no message." }, { status: 502 });
      }

      // No tool calls means the model is done and this is the answer.
      if (!reply.tool_calls?.length) {
        return NextResponse.json({
          reply: reply.content ?? "",
          toolCalls: trace,
        });
      }

      messages.push(reply);

      // Run the calls the model asked for, and record each one for the UI.
      for (const call of reply.tool_calls) {
        const started = Date.now();
        let args: Record<string, unknown> = {};
        let result: string;
        let failed = false;

        try {
          args = parseToolArgs(call.function.arguments);
          result = await callTool(call.function.name, args, token);
        } catch (err) {
          failed = true;
          // The failure goes back to the model as the tool's result, not as an
          // exception. That's what lets it recover — apologise, retry with
          // different arguments — instead of the whole request dying.
          result =
            err instanceof McpError || err instanceof Error
              ? `Error: ${err.message}`
              : "Error: the tool failed.";
        }

        trace.push({
          name: call.function.name,
          args,
          result,
          ms: Date.now() - started,
          failed,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: result,
        });
      }
    }

    // Ran out of rounds while the model was still reaching for tools.
    return NextResponse.json({
      reply:
        "I kept reaching for tools and didn't converge on an answer. Try asking for one thing at a time.",
      toolCalls: trace,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
