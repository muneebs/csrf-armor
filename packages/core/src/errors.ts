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

/**
 * Error thrown when a request is rejected by Fetch Metadata validation.
 *
 * Indicates that `Sec-Fetch-Site` (and optionally `Sec-Fetch-Mode` / `Sec-Fetch-Dest`)
 * signaled a cross-site or otherwise untrusted request.
 *
 * @public
 */
export class FetchMetadataError extends CsrfError {
  constructor(reason = 'Fetch metadata indicates untrusted request') {
    super(reason, 'FETCH_METADATA_MISMATCH');
  }
}

/**
 * Error thrown when a request's Content-Type is missing or not in the allowlist.
 *
 * @public
 */
export class ContentTypeError extends CsrfError {
  constructor(reason = 'Invalid or missing Content-Type') {
    super(reason, 'CONTENT_TYPE_INVALID');
  }
}

/**
 * Error thrown when a session-bound token does not match the current session.
 *
 * @public
 */
export class SessionMismatchError extends CsrfError {
  constructor() {
    super(
      'CSRF token session binding does not match the current session',
      'SESSION_MISMATCH'
    );
  }
}

/**
 * Error thrown when the Web Crypto API is unavailable.
 *
 * This happens in unsupported runtimes or non-secure contexts (plain HTTP).
 *
 * @public
 */
export class CryptoUnavailableError extends CsrfError {
  constructor() {
    super(
      '@csrf-armor requires Web Crypto API (crypto.subtle). Ensure you are running in a secure context (HTTPS) or a supported runtime (Node.js 18+, Deno, Cloudflare Workers, Bun).',
      'CRYPTO_UNAVAILABLE',
      500
    );
  }
}

/**
 * Error thrown when the configured secret does not meet minimum strength requirements.
 *
 * @public
 */
export class WeakSecretError extends CsrfError {
  constructor() {
    super(
      'CSRF secret must be at least 32 characters. Use generateSecureSecret() to create a strong secret.',
      'WEAK_SECRET',
      500
    );
  }
}

/**
 * Error thrown when no secret is provided and the library is running in production.
 *
 * @public
 */
export class MissingSecretError extends CsrfError {
  constructor() {
    super(
      'No CSRF secret provided. Set a strong secret in config.secret.',
      'MISSING_SECRET',
      500
    );
  }
}
