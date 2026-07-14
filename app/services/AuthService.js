import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { EVENTS } from "../core/EventBus.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../core/errors.js";

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

  async login({ email, password }) {
    this.#assertCredentials(email, password);

    const user = await this.#users.findByEmailWithPassword(email);

    // One identical error for "no such user" and "wrong password" — telling them
    // apart lets an attacker enumerate which emails have accounts.
    const passwordOk =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordOk) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const { passwordHash: _discard, ...safeUser } = user;
    return { user: safeUser, token: this.#issueToken(safeUser) };
  }
}
