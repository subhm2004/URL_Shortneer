import InMemoryCache from "./cache/InMemoryCache.js";
import NullCache from "./cache/NullCache.js";
import config from "./config/index.js";
import eventBus from "./core/EventBus.js";
import logger from "./core/logger.js";
import { registerClickObservers } from "./observers/clickObservers.js";

import ClickRepository from "./repositories/ClickRepository.js";
import CachedUrlRepository from "./repositories/CachedUrlRepository.js";
import UrlRepository from "./repositories/UrlRepository.js";
import UserRepository from "./repositories/UserRepository.js";

import AnalyticsService from "./services/AnalyticsService.js";
import AuthService from "./services/AuthService.js";
import GoogleAuthService from "./services/GoogleAuthService.js";
import UrlService from "./services/UrlService.js";

import AuthController from "./controllers/AuthController.js";
import LinkController from "./controllers/LinkController.js";
import UrlController from "./controllers/UrlController.js";

import ShortCodeStrategyFactory from "./strategies/shortcode/ShortCodeStrategyFactory.js";
import UrlValidator from "./validation/UrlValidator.js";

/**
 * Composition root — the one place that knows how the object graph is wired.
 *
 * Every class above takes its collaborators through its constructor and imports
 * none of them. That is what makes them testable: a unit test for UrlService
 * hands it a fake repository and a fake clock, with no database and no Express.
 * The cost of that is that *something* has to do the wiring, and it is this file
 * rather than a scattering of `new` calls and module-level singletons.
 */
export function buildContainer() {
  // ---- infrastructure -----------------------------------------------------
  const cache = config.cache.enabled
    ? new InMemoryCache({
        maxEntries: config.cache.maxEntries,
        ttlMs: config.cache.ttlMs,
      })
    : new NullCache(); // Null Object — no `if (cache)` guards anywhere downstream.

  // ---- repositories -------------------------------------------------------
  const userRepository = new UserRepository();
  const clickRepository = new ClickRepository();

  // The Decorator is applied here and nowhere else. Services are handed the
  // wrapped object and cannot tell it apart from the plain repository.
  const urlRepository = new CachedUrlRepository(new UrlRepository(), cache);

  // ---- domain collaborators ----------------------------------------------
  const shortCodeStrategy = ShortCodeStrategyFactory.create(config.shortCode.strategy, {
    length: config.shortCode.length,
  });

  const urlValidator = new UrlValidator({ baseUrl: config.baseUrl });

  // ---- services -----------------------------------------------------------
  const authService = new AuthService({ userRepository, eventBus, config });

  // Knows about Google; knows nothing about our users. AuthService is the other
  // way round. The only thing crossing between them is a plain profile object —
  // so adding GitHub later means a sibling of this class and no change here.
  const googleAuthService = new GoogleAuthService({ config });

  const urlService = new UrlService({
    urlRepository,
    urlValidator,
    shortCodeStrategy,
    eventBus,
    config,
  });

  const analyticsService = new AnalyticsService({ clickRepository, urlRepository });

  // ---- observers ----------------------------------------------------------
  // Subscribed once, at boot. Note they get the *undecorated* repositories:
  // writes should not go through the cache.
  registerClickObservers({
    eventBus,
    urlRepository: new UrlRepository(),
    clickRepository,
  });

  // ---- controllers --------------------------------------------------------
  const controllers = {
    auth: new AuthController({ authService, googleAuthService, config }),
    url: new UrlController({ urlService }),
    link: new LinkController({ urlService, analyticsService }),
  };

  logger.info("Container built", {
    shortCodeStrategy: config.shortCode.strategy,
    cache: config.cache.enabled ? "in-memory" : "disabled",
    googleOAuth: googleAuthService.enabled ? "enabled" : "not configured",
  });

  return {
    config,
    eventBus,
    cache,
    repositories: { userRepository, urlRepository, clickRepository },
    services: { authService, googleAuthService, urlService, analyticsService },
    controllers,
  };
}
