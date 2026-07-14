import { AsyncLocalStorage } from "node:async_hooks";

export interface AuthContext {
  token?: string;
}

// Per-request token, set by the HTTP transport from the Authorization header.
// Falls back to TRUNC_MCP_TOKEN for stdio (set in the MCP client config).
export const authStorage = new AsyncLocalStorage<AuthContext>();

export function getToken(): string | undefined {
  return authStorage.getStore()?.token ?? process.env.TRUNC_MCP_TOKEN;
}
