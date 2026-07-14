import { useContext } from "react";
import { AuthContext } from "./AuthContext.js";

export function useAuth() {
  const context = useContext(AuthContext);

  // The old guard checked `=== undefined`, but the context's default value is
  // null — so it never fired, and using this hook outside a provider crashed
  // with an unhelpful destructuring error instead of this message.
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
