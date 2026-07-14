import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("trunc-mcp running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting trunc-mcp:", err);
  process.exit(1);
});
