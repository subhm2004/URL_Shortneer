import config from "../config/index.js";
import { AppError, NotFoundError } from "../core/errors.js";
import logger from "../core/logger.js";

/** Terminal 404 for anything the router didn't match. */
export function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * The single exit point for every error in the app. Because every layer throws
 * an AppError, this is the only place that decides on a status code or what the
 * client is allowed to see.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const isApp = err instanceof AppError;
  const statusCode = isApp ? err.statusCode : 500;

  // Anything that isn't a deliberate AppError is a bug: log it with the stack.
  // Operational errors (bad input, wrong password) are noise at error level.
  if (!isApp || !err.isOperational) {
    logger.error(err.message, {
      method: req.method,
      path: req.originalUrl,
      stack: err.stack,
    });
  } else {
    logger.debug("Request rejected", {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      message: err.message,
    });
  }

  // 5xx messages can carry connection strings, table names, internal hostnames.
  // Only 4xx messages — which we wrote ourselves — are echoed back.
  const isClientError = statusCode >= 400 && statusCode < 500;
  const message = isClientError ? err.message : "Internal server error.";

  const body = { success: false, message };

  if (isApp && err.details) body.details = err.details;
  if (config.isDevelopment) body.stack = err.stack;

  res.status(statusCode).json(body);
}
