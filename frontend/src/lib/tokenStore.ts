const KEY = "trunc_token";

/**
 * The one module that knows where the JWT lives. Swapping localStorage for a
 * cookie later is a change to this file and nowhere else.
 *
 * Every method is guarded: this runs during server rendering too, where there is
 * no `window`, and it runs in Safari private mode, where touching localStorage
 * throws outright.
 */
export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },

  set(token: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      /* non-fatal — the session just won't survive a reload */
    }
  },

  clear(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
