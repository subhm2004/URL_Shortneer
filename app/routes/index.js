import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { optionalAuth, requireAuth } from "../middleware/authenticate.js";

/**
 * Routes are a function of the controllers rather than a module that imports
 * them, so the whole HTTP surface can be mounted against test doubles.
 */
export default function buildRoutes({ auth, url, link }, { google } = {}) {
  const api = Router();

  // ---- /api/auth ----------------------------------------------------------
  const authRoutes = Router();
  authRoutes.post("/register", asyncHandler(auth.register));
  authRoutes.post("/login", asyncHandler(auth.login));
  authRoutes.get("/me", requireAuth, asyncHandler(auth.me));

  /**
   * Lets the frontend ask which sign-in methods exist, instead of hardcoding the
   * answer. With no Google credentials configured the button simply isn't
   * rendered — rather than being rendered and then 404ing when clicked.
   */
  authRoutes.get("/providers", (_req, res) =>
    res.json({ success: true, data: { password: true, google: Boolean(google?.enabled) } }),
  );

  // Mounted only when configured. A half-configured OAuth route that redirects
  // to Google with an empty client_id produces a baffling Google error page;
  // a 404 at least says the truth.
  if (google?.enabled) {
    authRoutes.get("/google", asyncHandler(auth.googleStart));
    authRoutes.get("/google/callback", asyncHandler(auth.googleCallback));
  }

  api.use("/auth", authRoutes);

  // ---- /api/links (all auth-required) -------------------------------------
  const linkRoutes = Router();
  linkRoutes.use(requireAuth);
  linkRoutes.get("/my-links", asyncHandler(link.myLinks));
  linkRoutes.get("/clicks-by-day", asyncHandler(link.clicksByDay));
  linkRoutes.get("/overview", asyncHandler(link.overview));
  api.use("/links", linkRoutes);

  // ---- /api/shorten -------------------------------------------------------
  // optionalAuth, not requireAuth: anonymous shortening is a product feature.
  // When a token *is* present the link is attached to that user's account.
  api.post("/shorten", optionalAuth, asyncHandler(url.shorten));

  // ---- redirect -----------------------------------------------------------
  // Mounted at the root and matching a single path segment, so it must be the
  // last route registered — otherwise `/api/...` would be read as a short code.
  const redirectRoutes = Router();
  redirectRoutes.get("/:code", asyncHandler(url.redirect));

  return { api, redirect: redirectRoutes };
}
