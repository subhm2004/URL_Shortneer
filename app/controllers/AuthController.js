import ApiResponse from "../core/ApiResponse.js";
import { STATE_COOKIE } from "../services/GoogleAuthService.js";
import logger from "../core/logger.js";

/**
 * Controllers are purely a transport concern: pull values off the HTTP request,
 * call a service, shape the HTTP response. No validation, no bcrypt, no SQL, no
 * try/catch — errors propagate to errorHandler.
 */
export default class AuthController {
  #auth;
  #google;
  #config;

  constructor({ authService, googleAuthService, config }) {
    this.#auth = authService;
    this.#google = googleAuthService;
    this.#config = config;

    // Bound so they can be handed straight to the router as `controller.register`.
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.me = this.me.bind(this);
    this.googleStart = this.googleStart.bind(this);
    this.googleCallback = this.googleCallback.bind(this);
  }

  /**
   * The signed-in user's own record.
   *
   * The JWT carries only an id — deliberately, so a stale token can't serve a
   * stale name or a stale avatar. Anything the UI wants to *display* is fetched,
   * not decoded.
   */
  async me(req, res) {
    const user = await this.#auth.getById(req.user.id);
    return ApiResponse.ok().data({ user }).send(res);
  }

  async register(req, res) {
    const { name, email, password } = req.body ?? {};
    const { user, token } = await this.#auth.register({ name, email, password });

    return ApiResponse.created()
      .message("Account created.")
      .meta({ token })
      .data({ user })
      .send(res);
  }

  async login(req, res) {
    const { email, password } = req.body ?? {};
    const { user, token } = await this.#auth.login({ email, password });

    return ApiResponse.ok()
      .message("Signed in.")
      .meta({ token })
      .data({ user })
      .send(res);
  }

  /* ---------------------------------------------------------------- Google */

  /** Kicks the browser over to Google's consent screen. */
  async googleStart(req, res) {
    const { state, nonce } = this.#google.createState();

    res.cookie(STATE_COOKIE, nonce, {
      httpOnly: true, // no script needs this; keep it out of reach of XSS
      secure: this.#config.isProduction, // http on localhost, https everywhere else
      sameSite: "lax", // must survive Google's top-level redirect back to us
      maxAge: 10 * 60 * 1000,
      path: "/api/auth",
    });

    return res.redirect(this.#google.authorizeUrl(state));
  }

  /**
   * Google sends the browser back here with a one-time code.
   *
   * This is a *browser navigation*, not an API call — so failures cannot be a
   * JSON 401. There is nothing to read it: the user is staring at a page. Every
   * error redirects back to the login screen with a reason instead.
   */
  async googleCallback(req, res) {
    const { code, state, error: googleError } = req.query;

    const back = (reason) =>
      res.redirect(
        `${this.#config.frontendUrl}/login?error=${encodeURIComponent(reason)}`,
      );

    // The user pressed "Cancel" on the consent screen. Not an error worth logging.
    if (googleError) {
      return back("Google sign-in was cancelled.");
    }

    if (!code) {
      return back("Google sign-in failed. Please try again.");
    }

    try {
      this.#google.verifyState(state, req.cookies?.[STATE_COOKIE]);

      const profile = await this.#google.exchangeCode(code);
      const { user, token } = await this.#auth.loginWithGoogle(profile);

      res.clearCookie(STATE_COOKIE, { path: "/api/auth" });
      logger.info("Signed in with Google", { userId: user.id });

      /**
       * The token goes back in the URL **fragment**, not the query string.
       *
       * A fragment is never sent to a server — not to ours, not in a Referer
       * header to whatever the user clicks next, and it stays out of server
       * access logs and proxy logs. A `?token=…` would leak into all of them.
       *
       * It still lands in browser history, which is why /auth/callback strips it
       * with history.replaceState the moment it has read it.
       *
       * (An httpOnly cookie would be tidier, but the token has to be readable by
       * JS: the /mcp page shows it to the user so they can paste it into their
       * MCP client.)
       */
      return res.redirect(`${this.#config.frontendUrl}/auth/callback#token=${token}`);
    } catch (err) {
      logger.warn("Google callback rejected", { error: err.message });
      return back(err.message || "Google sign-in failed.");
    }
  }
}
