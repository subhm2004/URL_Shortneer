/**
 * Express 5 forwards a rejected promise to the error handler on its own, but
 * wrapping keeps the intent explicit and keeps the controllers free of
 * try/catch — which is what let the old code drift into three different
 * error-handling styles.
 */
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
