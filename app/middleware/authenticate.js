import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { UnauthorizedError } from "../core/errors.js";

function readToken(req) {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Attaches `req.user` when a valid token is present, and leaves it undefined
 * otherwise. A *malformed* token is still a 401 — sending a broken token is a
 * client bug worth reporting, not the same thing as sending none.
 *
 * Used on /api/shorten, which anonymous visitors are allowed to call.
 */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();

  try {
    const { user } = jwt.verify(token, config.auth.jwtSecret);
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token."));
  }
}

/**
 * Rejects the request unless a valid token is present.
 *
 * This is the middleware the old code was missing: `auth.js` called `next()` when
 * no token was supplied, so every protected controller had to re-check
 * `if (!req.user)` itself — and `/api/shorten` was documented as auth-required
 * while actually being open.
 */
export function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) {
    return next(new UnauthorizedError("Sign in to access this resource."));
  }

  try {
    const { user } = jwt.verify(token, config.auth.jwtSecret);
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token."));
  }
}
