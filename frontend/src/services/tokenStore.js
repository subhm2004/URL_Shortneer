const TOKEN_KEY = "token";

/**
 * The one module that knows the JWT lives in localStorage. Everything else asks
 * this. Moving to a cookie or an in-memory store later is a change to this file
 * and nowhere else.
 */
const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      // Safari private mode throws on localStorage access.
      return null;
    }
  },

  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* non-fatal — the session just won't survive a reload */
    }
  },

  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export default tokenStore;
