import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { optionalAuth, requireAuth } from "../middleware/authenticate.js";
import { rateLimit } from "../middleware/rateLimit.js";

/**
 * Routes are a function of the controllers rather than a module that imports
 * them, so the whole HTTP surface can be mounted against test doubles.
 */
export default function buildRoutes(
  { auth, url, link },
  { google, limiters } = {},
) {
  const api = Router();

  // ---- /api/auth ----------------------------------------------------------
  const authRoutes = Router();

  /**
   * The auth limiter is deliberately mean, and it runs BEFORE the handler — the
   * point of brute-force protection is to refuse the work, not to do it and then
   * report that you did too much of it. bcrypt is intentionally slow, so an
   * unlimited login endpoint is a CPU exhaustion attack with a free password
   * guess attached.
   */
  const authLimit = rateLimit(limiters.auth, "auth");

  authRoutes.post("/register", authLimit, asyncHandler(auth.register));
  authRoutes.post("/login", authLimit, asyncHandler(auth.login));
  authRoutes.get("/me", requireAuth, asyncHandler(auth.me));

  /**
   * Lets the frontend ask which sign-in methods exist, instead of hardcoding the
   * answer. With no Google credentials configured the button simply isn't
   * rendered — rather than being rendered and then 404ing when clicked.
   */
  authRoutes.get("/providers", (_req, res) =>
    res.json({
      success: true,
      data: { password: true, google: Boolean(google?.enabled) },
    }),
  );

  // Mounted only when configured. A half-configured OAuth route that redirects to
  // Google with an empty client_id produces a baffling Google error page; a 404 at
  // least says the truth.
  if (google?.enabled) {
    authRoutes.get("/google", asyncHandler(auth.googleStart));
    authRoutes.get("/google/callback", asyncHandler(auth.googleCallback));
  }

  api.use("/auth", authRoutes);

  // ---- /api/links (all auth-required) -------------------------------------
  const linkRoutes = Router();
  linkRoutes.use(requireAuth);
  linkRoutes.use(rateLimit(limiters.read, "read"));

  linkRoutes.get("/my-links", asyncHandler(link.myLinks));
  linkRoutes.get("/clicks-by-day", asyncHandler(link.clicksByDay));
  linkRoutes.get("/overview", asyncHandler(link.overview));

  linkRoutes.delete("/:code", asyncHandler(link.remove));
  linkRoutes.patch("/:code", asyncHandler(link.repoint));

  api.use("/links", linkRoutes);

  // ---- /api/shorten -------------------------------------------------------
  /**
   * optionalAuth runs BEFORE the limiter, and the order is load-bearing: the
   * limiter keys a signed-in caller by user id and an anonymous one by IP, and it
   * can only tell them apart once `req.user` is populated.
   *
   * Reversed, every request would be limited by IP — so an office behind one NAT
   * would share a single budget, and the first person to paste ten links would
   * lock out their colleagues.
   */
  api.post(
    "/shorten",
    optionalAuth,
    rateLimit(limiters.shorten, "shorten"),
    asyncHandler(url.shorten),
  );

  // ---- redirect -----------------------------------------------------------
  /**
   * Deliberately NOT rate limited.
   *
   * This is the product. A popular link *should* be hammered — throttling it
   * would mean throttling the very success the app exists to produce. It is also
   * read-mostly and served from the cache, so it is the cheapest thing here.
   *
   * Mounted at the root and matching a single path segment, so it must be the
   * last route registered — otherwise `/api/...` would be read as a short code.
   */
  const redirectRoutes = Router();
  redirectRoutes.get("/:code", asyncHandler(url.redirect));

  return { api, redirect: redirectRoutes };
}
