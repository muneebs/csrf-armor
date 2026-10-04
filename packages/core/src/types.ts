/**
 * CSRF protection strategy types.
 *
 * Each strategy provides different levels of security and compatibility:
 *
 * - `double-submit`: Classic double-submit cookie pattern. Good for most applications.
 * - `signed-double-submit`: Enhanced double-submit with cryptographic signatures. Recommended for high-security applications.
 * - `signed-token`: Expiring signed tokens bound to the incoming CSRF cookie. No server-side session store required.
 * - `origin-check`: Validates request origin against allowed domains. Simple but less robust.
 * - `hybrid`: Combines multiple strategies for maximum security and flexibility.
 */
export type CsrfStrategy =
  | 'double-submit'
  | 'signed-double-submit'
  | 'signed-token'
  | 'origin-check'
  | 'hybrid';

/**
 * Cookie name prefixes that browsers enforce.
 *
 * - `__Host-`: the browser only accepts the cookie with `Secure`, `Path=/` and
 *   no `Domain`, from a secure origin. Sibling subdomains and plain-HTTP
 *   origins cannot set or overwrite it (blocks cookie tossing).
 * - `__Secure-`: the browser only accepts the cookie with `Secure`, from a
 *   secure origin. Sibling subdomains can still set it with `Domain`.
 */
export type CookiePrefix = '__Host-' | '__Secure-';

/**
 * Cookie configuration options for CSRF tokens.
 *
 * These options control how CSRF tokens are stored in HTTP cookies,
 * affecting both security and compatibility with different browsers and deployments.
 */
export interface CookieOptions {
  /** Cookie name, without any prefix (default: 'csrf-token') */
  name?: string;
  /**
   * Browser-enforced cookie name prefix (default: none).
   *
   * Prepended to `name` and to the `-server` cookie used by
   * `signed-double-submit`, e.g. `__Host-csrf-token` and
   * `__Host-csrf-token-server`. Client-side readers must use the full name.
   *
   * `__Host-` requires `secure: true`, `path: '/'` and no `domain`;
   * `__Secure-` requires `secure: true`. Invalid combinations throw a
   * {@link CsrfConfigError} when the protection is created.
   */
  prefix?: CookiePrefix | false;
  /** Require HTTPS for cookie transmission (default: true) */
  secure?: boolean;
  /** Prevent client-side JavaScript access (default: false for client access) */
  httpOnly?: boolean;
  /** SameSite attribute for CSRF protection (default: 'lax') */
  sameSite?: 'strict' | 'lax' | 'none';
  /** Cookie path scope (default: '/') */
  path?: string;
  /** Cookie domain scope (optional) */
  domain?: string;
  /** Cookie expiration time in seconds (optional) */
  maxAge?: number;
}

/**
 * Required cookie options with all mandatory fields present.
 *
 * Internal type used after configuration merging to ensure all
 * required cookie properties are available for the CSRF system.
 *
 * @internal
 */
export interface RequiredCookieOptions {
  /** Full cookie name, including `prefix` when one is set */
  name: string;
  prefix?: CookiePrefix;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

/**
 * Token configuration options for CSRF protection.
 *
 * Controls how CSRF tokens are generated, transmitted, and validated.
 */
export interface TokenOptions {
  /** Token expiration time in seconds (default: 3600) */
  expiry?: number;
  /**
   * Time threshold in seconds before expiry when new tokens should be issued (default: 500)
   */
  reissueThreshold?: number;
  /** HTTP header name for token transmission (default: 'X-CSRF-Token') */
  headerName?: string;
  /** Form field name for token submission (default: 'csrf_token') */
  fieldName?: string;
}

/**
 * Required token options with all mandatory fields present.
 *
 * Internal type used after configuration merging to ensure all
 * required token properties are available for the CSRF system.
 *
 * @internal
 */
export interface RequiredTokenOptions {
  expiry: number;
  reissueThreshold: number;
  headerName: string;
  fieldName: string;
}

/**
 * Main CSRF protection configuration interface.
 *
 * Defines all available options for configuring CSRF protection behavior,
 * including security strategies, token settings, cookie options, and various
 * filtering mechanisms.
 *
 * @example
 * ```typescript
 * const config: CsrfConfig = {
 *   strategy: 'signed-double-submit',
 *   secret: 'your-32-character-secret-key-here',
 *   token: {
 *     expiry: 3600,
 *     headerName: 'X-CSRF-Token',
 *     fieldName: 'csrf_token',
 *     reissueThreshold: 500
 *   },
 *   cookie: {
 *     name: 'csrf-token',
 *     secure: true,
 *     httpOnly: true,
 *     sameSite: 'strict'
 *   },
 *   allowedOrigins: ['https://yourdomain.com'],
 *   excludePaths: ['/api/public', '/health'],
 *   skipContentTypes: ['application/json']
 * };
 * ```
 */
export interface CsrfConfig {
  /** CSRF protection strategy to use (default: 'hybrid') */
  strategy?: CsrfStrategy;
  /** Token generation and validation options */
  token?: TokenOptions;
  /** Cookie storage and security options */
  cookie?: CookieOptions;
  /** Secret key for cryptographic operations (auto-generated if not provided) */
  secret?: string;
  /** List of allowed request origins for origin-check strategy */
  allowedOrigins?: readonly string[];
  /** URL paths to exclude from CSRF protection */
  excludePaths?: readonly string[];
  /**
   * Media types (`type/subtype`) to skip CSRF validation for. Matched exactly
   * and case-insensitively against the request's media type; Content-Type
   * parameters such as `charset` are ignored, and prefixes are not matched.
   */
  skipContentTypes?: readonly string[];
  /**
   * Opt-in session binding for the signed strategies (`signed-token`,
   * `hybrid` and `signed-double-submit`).
   *
   * Return the current authenticated session's identifier, or `undefined`
   * for anonymous requests. The value is mixed into the token signature, so
   * a token or cookie pair issued in one session fails validation in any
   * other, including pairs planted by a sibling subdomain. Tokens are
   * reissued automatically on the next safe request after the session
   * changes (for example after login).
   *
   * Use a stable, server-side value such as `req.session.id`, never a value
   * the client can choose. Ignored by `double-submit` and `origin-check`.
   *
   * @example
   * ```typescript
   * getSessionId: (_csrfRequest, req) => (req as express.Request).session?.id
   * ```
   */
  getSessionId?: SessionIdResolver;
}

/**
 * Resolves the session identifier a signed CSRF token is bound to.
 *
 * @param request - Normalized request built by the framework adapter
 * @param frameworkRequest - The original framework request passed to `protect()`
 * @returns The session identifier, or `undefined` for anonymous requests
 */
export type SessionIdResolver = (
  request: CsrfRequest,
  frameworkRequest: unknown
) => string | undefined | Promise<string | undefined>;

/**
 * Complete CSRF configuration with all required fields present.
 *
 * Internal type used after configuration merging and validation to ensure
 * all necessary configuration properties are available for the CSRF system.
 *
 * @internal
 */
export interface RequiredCsrfConfig {
  strategy: CsrfStrategy;
  token: RequiredTokenOptions;
  cookie: RequiredCookieOptions;
  secret: string;
  allowedOrigins: readonly string[];
  excludePaths: readonly string[];
  skipContentTypes: readonly string[];
  getSessionId?: SessionIdResolver;
}

/**
 * Result of CSRF token validation.
 *
 * Contains the validation outcome and optional reason for failure.
 *
 * @internal
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
}

/**
 * Internal structure of a CSRF token payload.
 *
 * Used for signed token strategies that include expiration and nonce data.
 *
 * @internal
 */
export interface TokenPayload {
  readonly exp: number;
  readonly nonce: string;
}

/**
 * Normalized request interface for framework-agnostic CSRF processing.
 *
 * Framework adapters convert their specific request formats into this
 * standardized format for consistent CSRF protection logic.
 */
export interface CsrfRequest {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string;
  /** Request URL (absolute or relative) */
  url: string;
  /** Request headers in various formats */
  headers: Map<string, string> | Record<string, string> | Headers;
  /** Request cookies in various formats */
  cookies: Map<string, string> | Record<string, string>;
  /** Request body (can be any format depending on framework) */
  body?: unknown;
}

/**
 * Response data structure for CSRF protection.
 *
 * Contains headers and cookies that need to be applied to the framework
 * response to complete the CSRF protection setup.
 */
export interface CsrfResponse {
  /** Headers to add to the response */
  headers: Map<string, string> | Record<string, string>;
  /** Cookies to set on the response with their options */
  cookies:
    | Map<string, { value: string; options?: CookieOptions }>
    | Record<string, { value: string; options?: CookieOptions }>;
}

/**
 * Result of CSRF protection operation.
 *
 * Indicates whether the protection was successful and provides
 * additional information like generated tokens or failure reasons.
 */
export interface CsrfProtectResult {
  readonly success: boolean;
  readonly token?: string;
  readonly reason?: string;
}

/**
 * Framework adapter interface for CSRF protection.
 *
 * Adapters bridge the gap between framework-specific request/response
 * objects and the generic CSRF protection system. Each supported
 * framework (Express, Next.js, etc.) implements this interface.
 *
 * @template TRequest - Framework-specific request type
 * @template TResponse - Framework-specific response type
 *
 * @example
 * ```typescript
 * // Example adapter implementation
 * class MyFrameworkAdapter implements CsrfAdapter<MyRequest, MyResponse> {
 *   extractRequest(req: MyRequest): CsrfRequest {
 *     return {
 *       method: req.method,
 *       url: req.url,
 *       headers: new Map(Object.entries(req.headers)),
 *       cookies: new Map(Object.entries(req.cookies)),
 *       body: req.body
 *     };
 *   }
 *
 *   applyResponse(res: MyResponse, csrfResponse: CsrfResponse): MyResponse {
 *     // Apply headers and cookies to framework response
 *     return res;
 *   }
 *
 *   async getTokenFromRequest(req: CsrfRequest, config: RequiredCsrfConfig): Promise<string | undefined> {
 *     // Extract token from headers, body, or query parameters
 *     return token;
 *   }
 * }
 * ```
 */
export interface CsrfAdapter<TRequest = unknown, TResponse = unknown> {
  /**
   * Extracts CSRF-relevant data from a framework request.
   *
   * @param req - Framework-specific request object
   * @returns Normalized CSRF request data
   */
  extractRequest(req: TRequest): CsrfRequest;

  /**
   * Applies CSRF response data to a framework response.
   *
   * @param res - Framework-specific response object
   * @param csrfResponse - CSRF headers and cookies to apply
   * @returns Modified framework response
   */
  applyResponse(res: TResponse, csrfResponse: CsrfResponse): TResponse;

  /**
   * Extracts CSRF token from request using framework-specific logic.
   *
   * @param req - Normalized CSRF request
   * @param config - CSRF configuration
   * @returns Promise resolving to extracted token or undefined
   */
  getTokenFromRequest(
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined>;
}
