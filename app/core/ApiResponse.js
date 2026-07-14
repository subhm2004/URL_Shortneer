/**
 * Builder — every endpoint used to hand-assemble its own `{ success, message,
 * data }` object and they had drifted apart (some had `count`, some nested
 * `data.url`, some didn't). Going through a builder makes the envelope one
 * decision made in one place.
 *
 *   ApiResponse.ok().message("Short URL created").data({ url }).send(res)
 */
export default class ApiResponse {
  #status = 200;
  #message = null;
  #data = undefined;
  #meta = {};

  static ok() {
    return new ApiResponse().status(200);
  }

  static created() {
    return new ApiResponse().status(201);
  }

  status(code) {
    this.#status = code;
    return this;
  }

  message(text) {
    this.#message = text;
    return this;
  }

  data(payload) {
    this.#data = payload;
    return this;
  }

  /** Extra top-level fields, e.g. `.meta({ count: rows.length })`. */
  meta(fields) {
    this.#meta = { ...this.#meta, ...fields };
    return this;
  }

  toJSON() {
    const body = { success: this.#status < 400 };
    if (this.#message !== null) body.message = this.#message;
    Object.assign(body, this.#meta);
    if (this.#data !== undefined) body.data = this.#data;
    return body;
  }

  send(res) {
    return res.status(this.#status).json(this.toJSON());
  }
}
