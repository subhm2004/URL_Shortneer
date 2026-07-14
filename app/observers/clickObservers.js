import { EVENTS } from "../core/EventBus.js";
import logger from "../core/logger.js";

/**
 * Observers — the subscribers on the other side of the EventBus.
 *
 * Everything here runs *after* the visitor has already been redirected. That is
 * the whole point of the Observer seam: adding a new side-effect of a click
 * (geo-IP lookup, a webhook, a rate-limit counter) means registering another
 * subscriber here, and the redirect path stays exactly as fast as it is today.
 */
export function registerClickObservers({ eventBus, urlRepository, clickRepository }) {
  /** Keeps urls.click_count current — one atomic UPDATE, no read-modify-write. */
  eventBus.subscribe(EVENTS.LINK_CLICKED, async ({ urlId }) => {
    await urlRepository.incrementClickCount(urlId);
  });

  /** Appends the row the per-day chart aggregates over. */
  eventBus.subscribe(EVENTS.LINK_CLICKED, async ({ urlId, referer, userAgent }) => {
    await clickRepository.record({ urlId, referer, userAgent });
  });

  eventBus.subscribe(EVENTS.LINK_CLICKED, async ({ urlCode }) => {
    logger.debug("Link clicked", { urlCode });
  });

  eventBus.subscribe(EVENTS.LINK_CREATED, async ({ urlId, userId }) => {
    logger.info("Link created", { urlId, anonymous: userId === null });
  });

  eventBus.subscribe(EVENTS.USER_REGISTERED, async ({ userId }) => {
    logger.info("User registered", { userId });
  });
}
