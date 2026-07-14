import { createContext } from "react";

/**
 * Split across three files on purpose: a module that exports both a component
 * and a non-component breaks React Fast Refresh, which is what
 * react-refresh/only-export-components was telling us.
 *
 *   AuthContext.js   — the context object (here)
 *   AuthProvider.jsx — the component
 *   useAuth.js       — the hook
 */
export const AuthContext = createContext(null);
