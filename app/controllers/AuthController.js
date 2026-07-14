import ApiResponse from "../core/ApiResponse.js";

/**
 * Controllers are now purely a transport concern: pull values off the HTTP
 * request, call a service, shape the HTTP response. No validation, no bcrypt, no
 * SQL, no try/catch — errors propagate to errorHandler.
 */
export default class AuthController {
  #auth;

  constructor({ authService }) {
    this.#auth = authService;

    // Bound so they can be passed straight to the router as `controller.register`.
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
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
}
