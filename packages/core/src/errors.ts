/**
 * Base error class for all CSRF-related errors.
 *
 * Provides structured error information including error codes and HTTP status codes
 * for proper error handling and logging in applications using CSRF protection.
 *
 * @public
 * @example
 * ```typescript
 * import { CsrfError } from '@csrf-armor/core';
 *
 * try {
 *   await csrfProtection.protect(req, res);
 * } catch (error) {
 *   if (error instanceof CsrfError) {
 *     console.log(`CSRF Error [${error.code}]: ${error.message}`);
 *     res.status(error.statusCode).json({ error: error.message });
 *   }
 * }
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
 * This typically occurs when a user has a page open for longer than the
 * configured token expiry time, or when server time has drifted significantly
 * from the time the token was generated.
 *
 * @public
 * @example
 * ```typescript
 * import { TokenExpiredError } from '@csrf-armor/core';
 *
 * try {
 *   await csrfProtection.protect(req, res);
 * } catch (error) {
 *   if (error instanceof TokenExpiredError) {
 *     // Redirect to refresh the page and get a new token
 *     res.redirect(req.url);
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
 * This can occur due to:
 * - Corrupted token data during transmission
 * - Invalid token format or structure
 * - Failed cryptographic signature verification
 * - Tampered token content
 *
 * @public
 * @example
 * ```typescript
 * import { TokenInvalidError } from '@csrf-armor/core';
 *
 * try {
 *   await csrfProtection.protect(req, res);
 * } catch (error) {
 *   if (error instanceof TokenInvalidError) {
 *     console.log('Invalid token received:', error.message);
 *     // Generate and provide a new valid token
 *     const newToken = await csrfProtection.generateToken();
 *     res.status(400).json({ error: error.message, newToken });
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
 * Error thrown when request origin doesn't match allowed origins.
 *
 * Used primarily by the `origin-check` strategy to validate that requests
 * are coming from authorized domains. This helps prevent CSRF attacks from
 * malicious websites.
 *
 * @public
 * @example
 * ```typescript
 * import { OriginMismatchError } from '@csrf-armor/core';
 *
 * try {
 *   await csrfProtection.protect(req, res);
 * } catch (error) {
 *   if (error instanceof OriginMismatchError) {
 *     console.log('Blocked request from unauthorized origin:', error.message);
 *     res.status(403).json({
 *       error: 'Request from unauthorized origin',
 *       origin: req.headers.origin
 *     });
 *   }
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
