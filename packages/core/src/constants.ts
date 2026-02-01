import { generateSecureSecret } from './crypto.js';
import type { CookieOptions, CsrfConfig } from './types.js';

/**
 * HTTP methods that are considered safe and don't require CSRF protection.
 *
 * These methods are defined by RFC 7231 as safe methods that should not have
 * side effects on the server. CSRF attacks typically target state-changing
 * operations, so these methods can safely bypass CSRF validation.
 *
 * @public
 * @example
 * ```typescript
 * import { SAFE_METHODS } from '@csrf-armor/core';
 *
 * if (SAFE_METHODS.includes(request.method)) {
 *   // Skip CSRF validation for safe methods
 *   return next();
 * }
 * ```
 */
export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

/**
 * Default name for the CSRF token cookie.
 * Used when no custom cookie name is specified in configuration.
 *
 * @internal
 */
export const DEFAULT_CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Suffix appended to server-side CSRF cookies for signed strategies.
 * Server cookies contain the signature or validation data.
 *
 * @internal
 */
export const SERVER_CSRF_COOKIE_SUFFIX = '-server';

/**
 * Default HTTP header name for CSRF tokens.
 * Commonly used in AJAX requests and API calls.
 *
 * @internal
 */
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

/**
 * HTTP header name used to communicate the CSRF strategy to clients.
 * Helps debugging and allows clients to adapt their token handling.
 *
 * @internal
 */
export const CSRF_STRATEGY_HEADER = 'x-csrf-strategy';

/**
 * Default length for cryptographic nonces in most CSRF strategies.
 * Provides 256 bits of entropy for strong security.
 *
 * @internal
 */
export const DEFAULT_NONCE_LENGTH = 32;

/**
 * Shorter nonce length used specifically for origin-check strategy.
 * Since origin-check relies primarily on origin validation, a smaller
 * nonce is sufficient for preventing replay attacks.
 *
 * @internal
 */
export const ORIGIN_CHECK_NONCE_LENGTH = 16;

/**
 * Default cookie configuration for CSRF tokens.
 *
 * Provides secure defaults suitable for most web applications:
 * - `secure: true` - Requires HTTPS (should be overridden for development)
 * - `httpOnly: false` - Allows JavaScript access for SPA token retrieval
 * - `sameSite: 'lax'` - Provides CSRF protection while allowing normal navigation
 * - `path: '/'` - Makes cookie available across the entire application
 *
 * @public
 * @example
 * ```typescript
 * import { DEFAULT_COOKIE_OPTIONS } from '@csrf-armor/core';
 *
 * const customConfig = {
 *   ...DEFAULT_COOKIE_OPTIONS,
 *   secure: false, // For development
 *   domain: '.example.com' // For subdomain sharing
 * };
 * ```
 */
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  name: 'csrf-token',
  secure: true,
  httpOnly: false,
  sameSite: 'lax',
  path: '/',
} as const;

/**
 * Default CSRF protection configuration.
 *
 * Provides a complete, secure configuration suitable for production use:
 * - Uses `signed-double-submit` strategy for maximum security
 * - 1-hour token expiry with automatic reissue at 500 seconds
 * - Standard header and field names for broad compatibility
 * - Secure cookie defaults
 *
 * **Security Note**: The default secret is randomly generated and will be
 * different on each application restart. For production, always provide
 * a consistent secret key.
 *
 * @public
 * @example
 * ```typescript
 * import { DEFAULT_CONFIG } from '@csrf-armor/core';
 *
 * // Use defaults with custom secret
 * const config = {
 *   ...DEFAULT_CONFIG,
 *   secret: process.env.CSRF_SECRET || 'your-secret-key'
 * };
 *
 * // Override specific settings
 * const customConfig = {
 *   ...DEFAULT_CONFIG,
 *   strategy: 'double-submit',
 *   token: {
 *     ...DEFAULT_CONFIG.token,
 *     expiry: 7200 // 2 hours
 *   }
 * };
 * ```
 */
export const DEFAULT_CONFIG: CsrfConfig = {
  strategy: 'signed-double-submit',
  token: {
    expiry: 3600,
    headerName: 'X-CSRF-Token',
    fieldName: 'csrf_token',
    reissueThreshold: 500,
  },
  cookie: DEFAULT_COOKIE_OPTIONS,
  secret: generateSecureSecret(),
  allowedOrigins: [],
  excludePaths: [],
  skipContentTypes: [],
} as const;
