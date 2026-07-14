/**
 * A single error hierarchy so every layer throws the same shape and one
 * error-handling middleware can map it to a status code. Previously each
 * controller invented its own `res.status(500).json(...)` block.
 *
 * `isOperational` marks errors we expected and can safely show the user;
 * anything else is a bug and gets a generic message.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized — sign in first.") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden.") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists.") {
    super(message, 409);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error.") {
    super(message, 500, { isOperational: false });
  }
}
