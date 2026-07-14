import { EventEmitter } from "node:events";
import logger from "./logger.js";

export const EVENTS = Object.freeze({
  LINK_CLICKED: "link.clicked",
  LINK_CREATED: "link.created",
  USER_REGISTERED: "user.registered",
});

/**
 * Observer — publishers (the redirect handler) don't know or care who is
 * listening. This is what lets the redirect respond immediately while the click
 * is persisted in the background: the old code awaited a DB write before
 * sending the 301, so every visitor paid for our analytics.
 *
 * The trade-off is explicit: a click recorded via this bus can be lost if the
 * process dies in the ~1ms between emit and write. For click analytics that is
 * an acceptable price for a faster redirect. Subscribers must never throw —
 * `emit` swallows and logs so one bad observer can't take down a redirect.
 */
class EventBus extends EventEmitter {
  publish(event, payload) {
    // setImmediate defers observers to the next tick, so the caller's response
    // is already on the wire before any of them run.
    setImmediate(() => {
      try {
        super.emit(event, payload);
      } catch (err) {
        logger.error("Observer threw while handling event", {
          event,
          error: err.message,
        });
      }
    });
  }

  subscribe(event, handler) {
    const safe = async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error("Observer failed", { event, error: err.message });
      }
    };
    super.on(event, safe);
    return () => super.off(event, safe);
  }
}

export default new EventBus();
