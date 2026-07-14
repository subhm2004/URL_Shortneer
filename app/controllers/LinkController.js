import ApiResponse from "../core/ApiResponse.js";

export default class LinkController {
  #urls;
  #analytics;

  constructor({ urlService, analyticsService }) {
    this.#urls = urlService;
    this.#analytics = analyticsService;

    this.myLinks = this.myLinks.bind(this);
    this.clicksByDay = this.clicksByDay.bind(this);
    this.overview = this.overview.bind(this);
  }

  // requireAuth guarantees req.user — the `if (!req.user) 401` checks that used
  // to open every one of these methods are gone.
  async myLinks(req, res) {
    const links = await this.#urls.listForUser(req.user.id);

    return ApiResponse.ok()
      .meta({ count: links.length })
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
}
