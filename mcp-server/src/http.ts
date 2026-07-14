import "dotenv/config";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authStorage } from "./authContext.js";
import { createServer } from "./tools.js";

function parseBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.error(`[trunc-mcp] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "trunc-mcp", version: "0.3.0" });
});

app.post("/mcp", async (req, res) => {
  const token = parseBearer(req.header("authorization"));
  // In stateless mode, McpServer can only handle one request — create a
  // fresh instance per call. Shared state lives in tool implementations
  // (authStorage for HTTP, TRUNC_MCP_TOKEN env for stdio).
  const mcpServer = createServer();
  try {
    await authStorage.run({ token }, async () => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        mcpServer.close();
      });
    });
  } catch (err) {
    console.error("MCP request error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.error(`trunc-mcp HTTP listening on :${port}/mcp`);
});

