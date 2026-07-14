import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { EVENTS } from "../core/EventBus.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../core/errors.js";
import logger from "../core/logger.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default class AuthService {
  #users;
  #events;
  #config;

  constructor({ userRepository, eventBus, config }) {
    this.#users = userRepository;
    this.#events = eventBus;
    this.#config = config;
  }

  #issueToken(user) {
    // The `{ user: { id } }` nesting is kept because the MCP server and the
    // existing UI both decode tokens in this shape.
    return jwt.sign({ user: { id: user.id } }, this.#config.auth.jwtSecret, {
      expiresIn: this.#config.auth.jwtExpiresIn,
    });
  }

  #assertCredentials(email, password) {
    if (!email || !password) {
      throw new ValidationError("Email and password are both required.");
    }
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError("That email address doesn't look valid.");
    }
  }

  async register({ name, email, password }) {
    this.#assertCredentials(email, password);

    const minLength = this.#config.auth.minPasswordLength;
    if (password.length < minLength) {
      throw new ValidationError(`Password must be at least ${minLength} characters.`);
    }

    if (await this.#users.findByEmail(email)) {
      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, this.#config.auth.bcryptRounds);

    const user = await this.#users.create({
      name: name?.trim() || email.split("@")[0],
      email,
      passwordHash,
    });

    this.#events.publish(EVENTS.USER_REGISTERED, { userId: user.id });

    return { user, token: this.#issueToken(user) };
  }

  /** Resolves the id in a JWT to the user it names. */
  async getById(id) {
    const user = await this.#users.findById(id);
    if (!user) {
      // The token is valid but its subject is gone — a deleted account. Treat it
      // as unauthenticated rather than 404: the client's job is to sign in again,
      // not to go looking for a missing resource.
      throw new UnauthorizedError("This account no longer exists.");
    }
    return user;
  }

  async login({ email, password }) {
    this.#assertCredentials(email, password);

    const user = await this.#users.findByEmailWithPassword(email);

    // A Google-only account has no password_hash. bcrypt.compare(pw, undefined)
    // *throws* rather than returning false — so without this guard, trying to
    // password-login a Google user produces a 500 instead of a clean rejection.
    const passwordOk =
      user?.passwordHash &&
      (await bcrypt.compare(password, user.passwordHash));

    // One identical error for "no such user", "wrong password", and "this account
    // has no password" — telling them apart lets an attacker enumerate which
    // emails have accounts, and which of those use Google.
    if (!passwordOk) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const { passwordHash: _discard, ...safeUser } = user;
    return { user: safeUser, token: this.#issueToken(safeUser) };
  }

  /**
   * Turns a verified Google profile into one of our users, and issues our JWT.
   *
   * Three cases, in this order:
   *
   *   1. We've seen this Google id before        → sign them in
   *   2. We haven't, but the email already exists → LINK the two
   *   3. Neither                                  → create a new account
   *
   * Case 2 is the interesting one. Refusing to link would strand a user who
   * signed up with a password and later clicks "Continue with Google" — same
   * person, same address, told their email is taken by themselves. Linking is
   * only safe because GoogleAuthService has already refused any profile whose
   * email Google hasn't verified; without that check this branch would be an
   * account-takeover primitive.
   *
   * Their password keeps working. This adds a way in, it doesn't replace one.
   */
  async loginWithGoogle(profile) {
    const existingByGoogle = await this.#users.findByGoogleId(profile.googleId);
    if (existingByGoogle) {
      return { user: existingByGoogle, token: this.#issueToken(existingByGoogle), created: false };
    }

    const existingByEmail = await this.#users.findByEmail(profile.email);
    if (existingByEmail) {
      const linked = await this.#users.linkGoogle(existingByEmail.id, {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
      });
      logger.info("Linked Google to an existing account", { userId: linked.id });
      return { user: linked, token: this.#issueToken(linked), created: false };
    }

    const user = await this.#users.createFromGoogle(profile);
    this.#events.publish(EVENTS.USER_REGISTERED, { userId: user.id });

    return { user, token: this.#issueToken(user), created: true };
  }
}
