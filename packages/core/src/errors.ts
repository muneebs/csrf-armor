/**
 * Base error class for all CSRF-related errors.
 *
 * Provides structured error information including error codes and HTTP status codes
 * for proper error handling and logging in applications using CSRF protection.
 *
 * `protect()` does not throw for a failed check; it resolves with
 * `success: false` and a `reason`. These errors come from the token helpers
 * and from adapters that report failures as errors, such as the Express
 * middleware, which passes a `CsrfError` with code `CSRF_VERIFICATION_ERROR`
 * to `next()`.
 *
 * @public
 * @example
 * ```typescript
 * import { CsrfError } from '@csrf-armor/core';
 *
 * // Express error handler after csrfMiddleware()
 * app.use((err, req, res, next) => {
 *   if (err instanceof CsrfError) {
 *     return res.status(err.statusCode).json({ error: err.message, code: err.code });
 *   }
 *   next(err);
 * });
 * ```
 */
export class CsrfError extends Error {
  /**
   * Creates a new CSRF error.
   *
   * @param message - Human-readable error description
   * @param code - Machine-readable error code for programmatic handling
   * @param statusCode - HTTP status code to return (defaults to 403 Forbidden)
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Error thrown when a CSRF token has expired.
 *
 * Thrown by `parseSignedToken()` once the token's expiry has passed, typically
 * because a page was left open longer than `token.expiry`.
 *
 * @public
 * @example
 * ```typescript
 * import { parseSignedToken, TokenExpiredError } from '@csrf-armor/core';
 *
 * try {
 *   await parseSignedToken(token, secret);
 * } catch (error) {
 *   if (error instanceof TokenExpiredError) {
 *     // Ask the client to fetch a fresh token and retry
 *   }
 * }
 * ```
 */
export class TokenExpiredError extends CsrfError {
  constructor() {
    super('CSRF token has expired', 'TOKEN_EXPIRED');
  }
}

/**
 * Error thrown when a CSRF token is malformed or invalid.
 *
 * Thrown by `parseSignedToken()` and `verifySignedToken()` when:
 * - the token doesn't have the expected number of parts
 * - a part is empty or the expiry isn't a number
 * - the signature doesn't verify (tampered token, wrong secret or session)
 *
 * @public
 * @example
 * ```typescript
 * import { parseSignedToken, TokenInvalidError } from '@csrf-armor/core';
 *
 * try {
 *   await parseSignedToken(token, secret);
 * } catch (error) {
 *   if (error instanceof TokenInvalidError) {
 *     console.warn(error.message); // e.g. "CSRF token is invalid: Invalid signature"
 *   }
 * }
 * ```
 */
export class TokenInvalidError extends CsrfError {
  /**
   * Creates a new token invalid error.
   *
   * @param reason - Specific reason why the token is invalid
   */
  constructor(reason = 'Invalid token format') {
    super(`CSRF token is invalid: ${reason}`, 'TOKEN_INVALID');
  }
}

/**
 * Error describing a request origin that isn't in `allowedOrigins`.
 *
 * The `origin-check` and `hybrid` strategies use its message as the failure
 * `reason`; request protection reports it there rather than throwing.
 *
 * @public
 * @example
 * ```typescript
 * const result = await csrf.protect(request, response);
 * if (!result.success) {
 *   console.warn(result.reason); // e.g. 'Origin "https://evil.example" is not allowed'
 * }
 * ```
 */
export class OriginMismatchError extends CsrfError {
  /**
   * Creates a new origin mismatch error.
   *
   * @param origin - The unauthorized origin that was detected
   */
  constructor(origin: string) {
    super(`Origin "${origin}" is not allowed`, 'ORIGIN_MISMATCH');
  }
}
