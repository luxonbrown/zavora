/**
 * Error type + middleware.
 *
 * Controllers throw `HttpError`; `asyncHandler` forwards rejected promises into
 * Express's error pipeline so no route needs its own try/catch. The final
 * handler never leaks internals unless the error is explicitly marked expose.
 */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.expose = true;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new HttpError(400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new HttpError(401, message);
  }

  static forbidden(message = 'Not allowed') {
    return new HttpError(403, message);
  }

  static notFound(message = 'Not found') {
    return new HttpError(404, message);
  }

  static conflict(message, details) {
    return new HttpError(409, message, details);
  }
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** 404 handler for unmatched /api paths. */
function notFound(req, res, next) {
  next(new HttpError(404, `No route for ${req.method} ${req.originalUrl}`));
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[zavora] error:', err.message);
    if (err.sql) console.error('[zavora] sql:', String(err.sql).slice(0, 300));
    if (err.code) console.error('[zavora] code:', err.code);
  }

  // Translate the MySQL/MariaDB errors that are genuinely client errors.
  let message = err.expose ? err.message : 'Internal server error';
  let details = err.details;

  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = err.expose ? err.message : 'That record already exists';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    status = 400;
    message = 'Referenced record does not exist';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    status = 503;
    message = 'Database unavailable';
  }

  res.status(status).json({
    ok: false,
    error: message,
    ...(details ? { details } : {}),
  });
}
/* eslint-enable no-unused-vars */

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
