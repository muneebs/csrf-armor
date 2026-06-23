import type { CookieOptions, CsrfConfig, ContentTypeOptions } from './types.js';

/**
 * HTTP methods that are considered safe and don't require CSRF protection.
 *
 * @public
 */
export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

/**
 * Default name for the CSRF token cookie.
 *
 * @internal
 */
export const DEFAULT_CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Suffix appended to server-side CSRF cookies for signed strategies.
 *
 * @internal
 */
export const SERVER_CSRF_COOKIE_SUFFIX = '-server';

/**
 * Prefix for `__Host-` cookies.
 *
 * @internal
 */
export const HOST_COOKIE_PREFIX = '__Host-';

/**
 * Default HTTP header name for CSRF tokens.
 *
 * @internal
 */
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

/**
 * HTTP header name used to communicate the CSRF strategy to clients.
 *
 * @internal
 */
export const CSRF_STRATEGY_HEADER = 'x-csrf-strategy';

/**
 * Default length for cryptographic nonces in most CSRF strategies.
 *
 * @internal
 */
export const DEFAULT_NONCE_LENGTH = 32;

/**
 * Shorter nonce length used specifically for origin-check strategy.
 *
 * @internal
 */
export const ORIGIN_CHECK_NONCE_LENGTH = 16;

/**
 * Default Content-Type options.
 *
 * @internal
 */
export const DEFAULT_CONTENT_TYPE_OPTIONS: ContentTypeOptions = {
  enforcePresence: false,
  allowedTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'application/graphql',
  ],
  skipValidation: [],
} as const;

/**
 * Default cookie configuration for CSRF tokens.
 *
 * @public
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
 * **Security Note**: No default secret is provided. In production you must
 * supply a strong secret (`secret` must be at least 32 characters).
 *
 * @public
 */
export const DEFAULT_CONFIG: CsrfConfig = {
  strategy: 'hybrid',
  token: {
    expiry: 3600,
    headerName: 'X-CSRF-Token',
    fieldName: 'csrf_token',
    reissueThreshold: 500,
  },
  cookie: DEFAULT_COOKIE_OPTIONS,
  allowedOrigins: [],
  excludePaths: [],
  contentType: DEFAULT_CONTENT_TYPE_OPTIONS,
  hostCookiePrefix: false,
  rotateOnUse: false,
  previousSecrets: [],
} as const;

/**
 * Default duration in seconds for the token rotation grace period.
 *
 * @internal
 */
export const DEFAULT_ROTATION_GRACE_PERIOD = 30;

/**
 * Minimum required secret length.
 *
 * @public
 */
export const MIN_REQUIRED_SECRET_LENGTH = 32;
