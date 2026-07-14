import { useCallback, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext.js";
import tokenStore from "../services/tokenStore.js";

export function AuthProvider({ children }) {
  // Read synchronously, in the initialiser. Because this happens before the
  // first render, `isAuthenticated` is already correct on that first render —
  // which is why there is no `isLoading` state here any more. The old code had
  // one, set it to false in an empty useEffect, and blocked the entire app from
  // rendering until that effect fired. It was guarding against an async read
  // that never existed.
  const [token, setToken] = useState(() => tokenStore.get());

  const login = useCallback((newToken) => {
    tokenStore.set(newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
  }, []);

  // `isAuthenticated` is derived, not stored. Keeping it as its own piece of
  // state meant two sources of truth that could disagree.
  const value = useMemo(
    () => ({ token, isAuthenticated: Boolean(token), login, logout }),
    [token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
