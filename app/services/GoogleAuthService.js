import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { UnauthorizedError, ValidationError } from "../core/errors.js";
import logger from "../core/logger.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const VALID_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);

/** The state cookie only has to survive one redirect. */
const STATE_TTL_SECONDS = 600;
export const STATE_COOKIE = "trunc_oauth_state";

/**
 * Google's half of the OAuth 2.0 authorization-code flow.
 *
 * Deliberately separate from AuthService: this class knows about Google, and
 * AuthService knows about *our* users. The only thing that crosses between them
 * is a plain profile object — so adding GitHub later means writing a sibling of
 * this class, and AuthService doesn't change.
 */
export default class GoogleAuthService {
  #config;

  constructor({ config }) {
    this.#config = config;
  }

  get enabled() {
    return this.#config.google.enabled;
  }

  /**
   * `state` is the CSRF defence for this flow.
   *
   * Without it, an attacker can complete their own Google consent, then trick
   * your browser into hitting our callback with *their* code — silently signing
   * you into the attacker's account, where anything you then shorten lands in
   * their dashboard. ("Login CSRF": the damage runs the other way round from
   * usual, which is exactly why it gets forgotten.)
   *
   * We sign the nonce into a short-lived JWT and also set it as a cookie. The
   * callback requires both, and requires them to match — so the code can only be
   * redeemed by the same browser that began the flow.
   */
  createState() {
    const nonce = randomBytes(16).toString("hex");
    const token = jwt.sign({ nonce }, this.#config.auth.jwtSecret, {
      expiresIn: STATE_TTL_SECONDS,
    });
    return { state: token, nonce };
  }

  verifyState(stateFromGoogle, nonceFromCookie) {
    if (!stateFromGoogle || !nonceFromCookie) {
      throw new UnauthorizedError("Sign-in session expired. Please try again.");
    }

    let payload;
    try {
      payload = jwt.verify(stateFromGoogle, this.#config.auth.jwtSecret);
    } catch {
      throw new UnauthorizedError("Sign-in session expired. Please try again.");
    }

    if (payload.nonce !== nonceFromCookie) {
      // Different browser, or a forged callback.
      throw new UnauthorizedError("Sign-in could not be verified. Please try again.");
    }
  }

  /** Where we send the browser to ask Google for consent. */
  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: this.#config.google.clientId,
      redirect_uri: this.#config.google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      // Ask for the account chooser every time. Otherwise a user with several
      // Google accounts is silently signed in as whichever one Google prefers,
      // with no way to pick.
      prompt: "select_account",
    });

    return `${GOOGLE_AUTH_URL}?${params}`;
  }

  /**
   * Exchanges the one-time code for tokens, and returns the user's profile.
   *
   * @returns {Promise<{ googleId: string, email: string, name: string, avatarUrl: string|null }>}
   */
  async exchangeCode(code) {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.#config.google.clientId,
        client_secret: this.#config.google.clientSecret,
        redirect_uri: this.#config.google.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Google's most common failure here is redirect_uri_mismatch, and its
      // message alone never says which URI it expected. Log ours so the fix is
      // obvious from the logs instead of a guessing game.
      logger.error("Google token exchange failed", {
        status: res.status,
        error: body.error,
        description: body.error_description,
        ourRedirectUri: this.#config.google.redirectUri,
      });
      throw new UnauthorizedError("Google sign-in failed. Please try again.");
    }

    return this.#profileFromIdToken(body.id_token);
  }

  /**
   * The id_token is a JWT signed by Google. We decode it without verifying the
   * signature, and that is safe *specifically because of how it reached us*: we
   * fetched it ourselves, over TLS, straight from Google's token endpoint,
   * authenticating with our client secret. Nothing untrusted touched it.
   * (OpenID Connect Core §3.1.3.7 says exactly this — TLS server validation may
   * stand in for signature checking on the code flow.)
   *
   * This would NOT be safe for a token that arrived via the browser, where the
   * signature is the only thing standing between us and a forged identity.
   *
   * The claims still get checked, because the transport says who sent it, not
   * what it says.
   */
  #profileFromIdToken(idToken) {
    if (!idToken) {
      throw new UnauthorizedError("Google returned no identity token.");
    }

    const claims = jwt.decode(idToken);
    if (!claims) {
      throw new UnauthorizedError("Google returned an unreadable identity token.");
    }

    if (!VALID_ISSUERS.has(claims.iss)) {
      throw new UnauthorizedError("Identity token came from an unexpected issuer.");
    }

    // Guards against a token minted for a different app being replayed at ours.
    if (claims.aud !== this.#config.google.clientId) {
      throw new UnauthorizedError("Identity token was issued for another application.");
    }

    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      throw new UnauthorizedError("Identity token has expired.");
    }

    /**
     * The one claim people forget — and the one that makes email-based account
     * linking safe.
     *
     * We link a Google sign-in to an existing password account when the emails
     * match. If we did that on an *unverified* email, anyone could register a
     * Google account claiming someone else's address and walk straight into
     * their account. Google only sets this true once it has proven ownership.
     */
    if (claims.email_verified !== true) {
      throw new ValidationError(
        "Your Google email address isn't verified, so it can't be used to sign in.",
      );
    }

    if (!claims.sub || !claims.email) {
      throw new UnauthorizedError("Google returned an incomplete profile.");
    }

    return {
      googleId: claims.sub,
      email: claims.email,
      name: claims.name || claims.email.split("@")[0],
      avatarUrl: claims.picture || null,
    };
  }
}
