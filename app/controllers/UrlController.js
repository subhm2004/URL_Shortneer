import ApiResponse from "../core/ApiResponse.js";

export default class UrlController {
  #urls;

  constructor({ urlService }) {
    this.#urls = urlService;

    this.shorten = this.shorten.bind(this);
    this.redirect = this.redirect.bind(this);
  }

  async shorten(req, res) {
    const { longUrl, customAlias } = req.body ?? {};

    const { url, created } = await this.#urls.shorten({
      longUrl,
      userId: req.user?.id ?? null,
      customAlias,
    });

    const response = created ? ApiResponse.created() : ApiResponse.ok();

    return response
      .message(created ? "Short URL created." : "You already shortened this URL.")
      .data({ url })
      .send(res);
  }

  async redirect(req, res) {
    const url = await this.#urls.resolve({
      urlCode: req.params.code,
      referer: req.get("referer") ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    // 302, not 301. A 301 is cached by the browser forever, so every click after
    // the first never reaches us — the click count would freeze at 1 and the link
    // could never be repointed.
    return res.redirect(302, url.longUrl);
  }
}
