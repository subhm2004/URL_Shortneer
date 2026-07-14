import ApiResponse from "../core/ApiResponse.js";
import { ValidationError } from "../core/errors.js";

export default class LinkController {
  #urls;
  #analytics;

  constructor({ urlService, analyticsService }) {
    this.#urls = urlService;
    this.#analytics = analyticsService;

    this.myLinks = this.myLinks.bind(this);
    this.clicksByDay = this.clicksByDay.bind(this);
    this.overview = this.overview.bind(this);
    this.remove = this.remove.bind(this);
    this.repoint = this.repoint.bind(this);
  }

  // requireAuth guarantees req.user — the `if (!req.user) 401` checks that used
  // to open every one of these methods are gone.
  async myLinks(req, res) {
    const { links, nextCursor } = await this.#urls.listForUser(req.user.id, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    return ApiResponse.ok()
      .meta({ count: links.length, nextCursor })
      .data(links)
      .send(res);
  }

  async clicksByDay(req, res) {
    const data = await this.#analytics.clicksByDay(req.user.id, req.query.days);

    return ApiResponse.ok()
      .meta({ count: data.length })
      .data(data)
      .send(res);
  }

  async overview(req, res) {
    const overview = await this.#analytics.overview(req.user.id);
    return ApiResponse.ok().data(overview).send(res);
  }

  async remove(req, res) {
    await this.#urls.remove({
      urlCode: req.params.code,
      userId: req.user.id,
    });

    return ApiResponse.ok().message("Link deleted.").send(res);
  }

  async repoint(req, res) {
    const { longUrl } = req.body ?? {};

    if (!longUrl) {
      throw new ValidationError("Send the new destination as `longUrl`.");
    }

    const url = await this.#urls.repoint({
      urlCode: req.params.code,
      userId: req.user.id,
      longUrl,
    });

    return ApiResponse.ok()
      .message("Destination updated.")
      .data({ url })
      .send(res);
  }
}
