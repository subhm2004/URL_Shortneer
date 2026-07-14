"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, me } from "@/lib/api";
import { tokenStore } from "@/lib/tokenStore";
import type { User } from "@/lib/types";

interface AuthValue {
  token: string | null;
  /** null while unknown — either signed out, or the fetch is still in flight. */
  user: User | null;
  isAuthenticated: boolean;
  /** False until the client has read localStorage — see the note below. */
  ready: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * The token cannot be read during render. Next renders this component on the
   * server first, where there is no localStorage — so reading it in a useState
   * initialiser would produce different HTML on the server and the client, and
   * React would throw a hydration mismatch.
   *
   * Hence `ready`: it is false for the first client render (matching the server),
   * then true once the effect has run. Anything that branches on auth state must
   * wait for it, or it will flash the signed-out view at a signed-in user.
   */
  useEffect(() => {
    setToken(tokenStore.get());
    setReady(true);
  }, []);

  /**
   * The JWT carries only an id, so anything the UI *displays* — name, avatar —
   * has to be fetched. Doing it here means one request for the whole app instead
   * of every component that wants a name asking for itself.
   *
   * A 401 means the token is stale (expired, or JWT_SECRET rotated). Clearing it
   * is the right response: leaving it in place would keep every subsequent
   * request failing while the UI insisted the user was signed in.
   */
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;

    me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isAuthError) {
          tokenStore.clear();
          setToken(null);
        }
        setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback((next: string) => {
    tokenStore.set(next);
    setToken(next);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  // isAuthenticated is derived, never stored. Two pieces of state that must agree
  // are two pieces of state that eventually won't.
  const value = useMemo<AuthValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      ready,
      login,
      logout,
    }),
    [token, user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
