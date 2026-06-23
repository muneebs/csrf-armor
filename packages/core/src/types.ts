/**
 * CSRF protection strategy types.
 *
 * Each strategy provides different levels of security and compatibility:
 *
 * - `signed-double-submit`: Enhanced double-submit with cryptographic signatures. Recommended stateless option.
 * - `signed-token`: Server-side token validation with cryptographic signing.
 * - `origin-check`: Validates request origin against allowed domains.
 * - `fetch-metadata`: Uses Fetch Metadata headers (`Sec-Fetch-Site`) as a defense-in-depth layer.
 * - `hybrid`: Combines origin validation, Fetch Metadata, Content-Type enforcement, and signed token validation.
 */
export type CsrfStrategy =
  | 'signed-double-submit'
  | 'signed-token'
  | 'origin-check'
  | 'fetch-metadata'
  | 'hybrid';

/**
 * Cookie configuration options for CSRF tokens.
 *
 * These options control how CSRF tokens are stored in HTTP cookies,
 * affecting both security and compatibility with different browsers and deployments.
 */
export interface CookieOptions {
  /** Cookie name (default: 'csrf-token') */
  name?: string;
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
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

/**
 * Content-Type enforcement options for CSRF protection.
 *
 * Helps prevent Content-Type manipulation attacks such as the Hono bypass
 * (GHSA-2234-fmw7-43wr) by requiring or whitelisting Content-Type headers on
 * state-changing requests.
 */
export interface ContentTypeOptions {
  /** Reject missing Content-Type on state-changing requests (default: false) */
  enforcePresence?: boolean;
  /** Whitelist of allowed media types (default includes common API types) */
  allowedTypes?: readonly string[];
  /** Content types whose requests skip CSRF validation (replaces v1 `skipContentTypes`) */
  skipValidation?: readonly string[];
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
 * Context passed to the `onFailure` hook when CSRF validation rejects a request.
 *
 * @public
 */
export interface OnFailureContext {
  /** CSRF strategy that rejected the request */
  strategy: CsrfStrategy;
  /** HTTP method of the rejected request */
  method: string;
  /** Request URL of the rejected request */
  url: string;
  /** Machine-readable rejection reason */
  reason: string;
  /** Request origin, if available */
  origin?: string | undefined;
  /** Value of `Sec-Fetch-Site` header, if available */
  secFetchSite?: string | undefined;
}

/**
 * Pluggable logger interface for security monitoring.
 *
 * The library never logs token values or secrets — only fingerprints and
 * diagnostic context. Both `console` and structured loggers (pino, winston,
 * etc.) can be adapted to this interface.
 *
 * @public
 */
export interface CsrfLogger {
  warn(
    message: string,
    context?: Record<string, unknown> | OnFailureContext
  ): void;
  error(
    message: string,
    context?: Record<string, unknown> | OnFailureContext
  ): void;
}

/**
 * Pluggable metrics interface for CSRF acceptance/rejection counters.
 *
 * Separated from `CsrfLogger` because metrics are counters for dashboards
 * (Prometheus, StatsD, OpenTelemetry), while logs are diagnostic text.
 *
 * @public
 */
export interface CsrfMetrics {
  onAccept(context: Record<string, unknown>): void;
  onReject(context: Record<string, unknown>): void;
  onTokenRotated(context: Record<string, unknown>): void;
}

/**
 * Callback used to retrieve a session identifier for session-bound tokens.
 *
 * The returned value is hashed before being included in the token, so the
 * raw session ID is never exposed in the token payload.
 *
 * @public
 */
export type GetSessionId = (
  req: CsrfRequest
) => string | undefined | Promise<string | undefined>;

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
 *   strategy: 'hybrid',
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
 *   contentType: {
 *     enforcePresence: true,
 *     allowedTypes: ['application/json']
 *   }
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
  /** Secret key for cryptographic operations (must be provided in production) */
  secret?: string;
  /** Previous secrets accepted for verification during key rotation */
  previousSecrets?: readonly string[];
  /** List of allowed request origins for origin-check strategy */
  allowedOrigins?: readonly string[];
  /** URL paths to exclude from CSRF protection */
  excludePaths?: readonly string[];
  /** Content-Type enforcement options (replaces v1 `skipContentTypes`) */
  contentType?: ContentTypeOptions;
  /** Enable `__Host-` cookie prefix as defense-in-depth (default: false) */
  hostCookiePrefix?: boolean;
  /** Rotate tokens after each successful state-changing request (default: false) */
  rotateOnUse?: boolean;
  /** Session ID callback to bind tokens to user sessions */
  getSessionId?: GetSessionId | undefined;
  /** Optional logger for security monitoring */
  logger?: CsrfLogger | undefined;
  /** Optional metrics sink for dashboards/SIEM */
  metrics?: CsrfMetrics | undefined;
  /** Optional hook invoked on validation failure */
  onFailure?: ((context: OnFailureContext) => void | Promise<void>) | undefined;
}

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
  previousSecrets: readonly string[];
  allowedOrigins: readonly string[];
  excludePaths: readonly string[];
  contentType: Required<ContentTypeOptions>;
  hostCookiePrefix: boolean;
  rotateOnUse: boolean;
  getSessionId?: GetSessionId | undefined;
  logger?: CsrfLogger | undefined;
  metrics?: CsrfMetrics | undefined;
  onFailure?: ((context: OnFailureContext) => void | Promise<void>) | undefined;
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
  readonly ver: number;
  readonly exp: number;
  readonly nonce: string;
  readonly sidHash?: string | undefined;
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
  /** Request cookies */
  cookies: Map<string, string>;
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
  cookies: Map<string, { value: string; options?: CookieOptions }>;
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
