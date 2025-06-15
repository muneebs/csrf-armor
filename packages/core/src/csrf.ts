import {
  CSRF_STRATEGY_HEADER,
  CSRF_TOKEN_HEADER,
  DEFAULT_CONFIG,
  DEFAULT_NONCE_LENGTH,
  ORIGIN_CHECK_NONCE_LENGTH,
  SAFE_METHODS,
  SERVER_CSRF_COOKIE_SUFFIX,
} from './constants.js';
import {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  timingSafeEqual,
  verifySignedToken,
} from './crypto.js';
import type {
  CsrfAdapter,
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  RequiredCookieOptions,
  RequiredCsrfConfig,
} from './types.js';
import { validateRequest } from './validation.js';

/**
 * Extracts the pathname from a URL string for path-based exclusion matching.
 *
 * Handles both absolute URLs and relative paths safely. If URL parsing fails,
 * falls back to manual parsing by finding the query string delimiter.
 *
 * @param url - URL string to extract pathname from
 * @returns The pathname portion of the URL
 *
 * @internal
 */
function extractPathname(url: string): string {
  try {
    // Always return the full pathname for accurate excludePaths matching
    return new URL(url).pathname;
  } catch {
    const questionMarkIndex = url.indexOf('?');
    if (questionMarkIndex !== -1) {
      return url.substring(0, questionMarkIndex);
    }
    return url;
  }
}

/**
 * Normalizes request headers to a consistent Map format.
 *
 * Converts various header formats (Map, Headers object, plain object) into
 * a standardized Map<string, string> for consistent processing throughout
 * the CSRF protection system.
 *
 * @param rawHeaders - Headers in various formats from the request
 * @returns Normalized headers as a Map
 *
 * @internal
 */
function processHeaders(
  rawHeaders: CsrfRequest['headers']
): Map<string, string> {
  if (rawHeaders instanceof Map) {
    return rawHeaders;
  }

  return new Map(Object.entries(rawHeaders));
}

/**
 * Merges user configuration with default CSRF configuration values.
 *
 * Creates a complete configuration object by combining user-provided options
 * with secure defaults. Ensures all required fields are present and properly
 * typed for the CSRF protection system.
 *
 * @param defaultConfig - Default configuration values
 * @param userConfig - User-provided configuration overrides
 * @returns Complete CSRF configuration with all required fields
 *
 * @internal
 */
function mergeConfig(
  defaultConfig: CsrfConfig,
  userConfig?: CsrfConfig
): RequiredCsrfConfig {
  const merged = {
    ...defaultConfig,
    ...userConfig,
    cookie: {
      ...defaultConfig.cookie,
      ...userConfig?.cookie,
    },
    token: {
      ...defaultConfig.token,
      ...userConfig?.token,
    },
  };

  // Ensure all required properties are present
  const config: RequiredCsrfConfig = {
    strategy: userConfig?.strategy ?? defaultConfig.strategy ?? 'hybrid',
    secret:
      userConfig?.secret ?? defaultConfig.secret ?? generateSecureSecret(),
    token: {
      expiry: merged.token?.expiry ?? 3600,
      headerName: merged.token?.headerName ?? 'X-CSRF-Token',
      fieldName: merged.token?.fieldName ?? 'csrf_token',
      reissueThreshold: merged.token?.reissueThreshold ?? 300,
    },
    cookie: {
      name: merged.cookie?.name ?? 'csrf-token',
      secure: merged.cookie?.secure ?? true,
      httpOnly: merged.cookie?.httpOnly ?? false,
      sameSite: merged.cookie?.sameSite ?? 'lax',
      path: merged.cookie?.path ?? '/',
    },
    allowedOrigins: merged.allowedOrigins ?? [],
    excludePaths: merged.excludePaths ?? [],
    skipContentTypes: merged.skipContentTypes ?? [],
  };

  // Add optional properties if they exist
  if (merged.cookie?.domain) {
    config.cookie.domain = merged.cookie.domain;
  }
  if (merged.cookie?.maxAge) {
    config.cookie.maxAge = merged.cookie.maxAge;
  }

  return config;
}

/**
 * Core CSRF protection engine that provides framework-agnostic CSRF security.
 *
 * This class implements multiple CSRF protection strategies and works with
 * framework-specific adapters to provide comprehensive protection against
 * Cross-Site Request Forgery attacks. It supports various strategies including
 * double-submit cookies, signed tokens, origin validation, and hybrid approaches.
 *
 * **Features:**
 * - Multiple CSRF protection strategies (double-submit, signed-double-submit, etc.)
 * - Framework-agnostic design with adapter pattern
 * - Configurable token expiration and validation
 * - Origin-based validation with whitelist support
 * - Path exclusion for public endpoints
 * - Content-type based skipping for certain request types
 * - Secure cryptographic operations using Web Crypto API
 * - Timing-safe token comparisons to prevent timing attacks
 *
 * **Available Strategies:**
 * - `double-submit`: Classic double-submit cookie pattern
 * - `signed-double-submit`: Enhanced double-submit with cryptographic signatures
 * - `signed-token`: Server-side token validation with signing
 * - `origin-check`: Validates request origin against allowed domains
 * - `hybrid`: Combines multiple strategies for maximum security
 *
 * @template TRequest - Framework-specific request type
 * @template TResponse - Framework-specific response type
 * @public
 *
 * @example
 * ```typescript
 * import { CsrfProtection } from '@csrf-armor/core';
 * import { ExpressAdapter } from '@csrf-armor/express';
 *
 * // Create CSRF protection with Express adapter
 * const csrf = new CsrfProtection(new ExpressAdapter(), {
 *   strategy: 'signed-double-submit',
 *   secret: 'your-secret-key',
 *   token: {
 *     expiry: 3600, // 1 hour
 *     headerName: 'X-CSRF-Token',
 *     fieldName: 'csrf_token'
 *   },
 *   cookie: {
 *     name: 'csrf-token',
 *     secure: true,
 *     httpOnly: false,
 *     sameSite: 'strict'
 *   },
 *   allowedOrigins: ['https://yourdomain.com'],
 *   excludePaths: ['/api/public', '/health']
 * });
 *
 * // Use in middleware
 * app.use(async (req, res, next) => {
 *   try {
 *     const result = await csrf.protect(req, res);
 *     if (result.success) {
 *       req.csrfToken = result.token;
 *       next();
 *     } else {
 *       res.status(403).json({ error: result.reason });
 *     }
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * ```
 * // Basic setup with Express
 * import { CsrfProtection } from '@csrf-armor/core';
 * import { ExpressAdapter } from '@csrf-armor/express';
 *
 * const csrf = new CsrfProtection(new ExpressAdapter(), {
 *   secret: 'your-32-character-secret-key-here',
 *   strategy: 'signed-double-submit',
 *   allowedOrigins: ['https://yourdomain.com'],
 *   excludePaths: ['/api/public']
 * });
 *
 * // In middleware
 * app.use(async (req, res, next) => {
 *   const result = await csrf.protect(req, res);
 *   if (!result.success) {
 *     return res.status(403).json({ error: 'CSRF validation failed' });
 *   }
 *   next();
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Advanced configuration
 * const csrf = new CsrfProtection(adapter, {
 *   strategy: 'hybrid',
 *   secret: process.env.CSRF_SECRET,
 *   token: {
 *     expiry: 7200, // 2 hours
 *     headerName: 'X-Custom-CSRF-Token',
 *     fieldName: 'custom_csrf_token'
 *   },
 *   cookie: {
 *     name: 'custom-csrf',
 *     secure: true,
 *     httpOnly: true,
 *     sameSite: 'strict'
 *   },
 *   excludePaths: ['/health', '/api/webhook'],
 *   skipContentTypes: ['application/json']
 * });
 * ```
 */

/**
 * Interface for token data used throughout the CSRF protection process.
 * @internal
 */
interface TokenData {
  clientToken: string;
  cookieToken: string;
  serverCookieToken?: string;
  cookieOptions: RequiredCookieOptions;
}

export class CsrfProtection<TRequest = unknown, TResponse = unknown> {
  private readonly config: RequiredCsrfConfig;
  private readonly adapter: CsrfAdapter<TRequest, TResponse>;

  /**
   * Creates a new CSRF protection instance.
   *
   * @param adapter - Framework-specific adapter for request/response handling
   * @param userConfig - Optional configuration overrides
   */
  constructor(
    adapter: CsrfAdapter<TRequest, TResponse>,
    userConfig?: CsrfConfig
  ) {
    this.adapter = adapter;
    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
  }

  /**
   * Checks if a request should be excluded from CSRF protection.
   *
   * @param request - The CSRF request to check
   * @returns true if the request should be skipped
   * @internal
   */
  private shouldSkipProtection(request: CsrfRequest): boolean {
    const pathname = extractPathname(request.url);
    if (this.config.excludePaths.some((path) => pathname.startsWith(path))) {
      return true;
    }

    const headers = processHeaders(request.headers);
    const contentType = headers.get('content-type') ?? '';
    return this.config.skipContentTypes.some((type) =>
      contentType.includes(type)
    );
  }

  /**
   * Attempts to reuse existing CSRF tokens if they are still valid.
   *
   * @param request - The CSRF request containing potential existing tokens
   * @returns Token data if reuse is possible, null otherwise
   * @internal
   */
  private async attemptTokenReuse(
    request: CsrfRequest
  ): Promise<TokenData | null> {
    if (!SAFE_METHODS.includes(request.method as never)) {
      return null;
    }

    const cookies =
      request.cookies instanceof Map
        ? request.cookies
        : new Map(Object.entries(request.cookies));

    const clientTokenFromRequest = cookies.get(this.config.cookie.name);
    const serverCookieTokenFromRequest = cookies.get(
      this.config.cookie.name + SERVER_CSRF_COOKIE_SUFFIX
    );

    if (!clientTokenFromRequest) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const reissueThreshold = this.config.token.reissueThreshold;

    try {
      switch (this.config.strategy) {
        case 'signed-token':
        case 'hybrid': {
          const payload = await parseSignedToken(
            clientTokenFromRequest,
            this.config.secret
          );
          if (payload.exp > currentTime + reissueThreshold) {
            return {
              clientToken: clientTokenFromRequest,
              cookieToken: clientTokenFromRequest,
              cookieOptions: { ...this.config.cookie, httpOnly: false },
            };
          }
          break;
        }
        case 'signed-double-submit': {
          if (serverCookieTokenFromRequest && clientTokenFromRequest) {
            try {
              const verifiedToken = await verifySignedToken(
                serverCookieTokenFromRequest,
                this.config.secret
              );
              if (timingSafeEqual(verifiedToken, clientTokenFromRequest)) {
                return {
                  clientToken: clientTokenFromRequest,
                  cookieToken: clientTokenFromRequest,
                  serverCookieToken: serverCookieTokenFromRequest,
                  cookieOptions: { ...this.config.cookie, httpOnly: false },
                };
              }
            } catch {
              // Invalid signature, fall through to generate new tokens
            }
          }
          break;
        }
      }
    } catch (error) {
      // Token invalid or expired, return null to generate new tokens
      return null;
    }

    return null;
  }

  /**
   * Builds the CSRF response with headers and cookies.
   *
   * @param tokenData - The token data to include in the response
   * @returns The CSRF response object
   * @internal
   */
  private buildCsrfResponse(tokenData: TokenData): CsrfResponse {
    const cookies = new Map([
      [
        this.config.cookie.name,
        {
          value: tokenData.cookieToken,
          options: tokenData.cookieOptions,
        },
      ],
    ]);

    if (tokenData.serverCookieToken) {
      cookies.set(`${this.config.cookie.name}-server`, {
        value: tokenData.serverCookieToken,
        options: {
          ...tokenData.cookieOptions,
          httpOnly: true,
        },
      });
    }

    return {
      headers: new Map([
        [CSRF_TOKEN_HEADER, tokenData.clientToken],
        [CSRF_STRATEGY_HEADER, this.config.strategy],
      ]),
      cookies,
    };
  }

  /**
   * Protects a request/response pair against CSRF attacks.
   *
   * This is the main method that applies CSRF protection to incoming requests.
   * It handles both token generation for safe methods (GET, HEAD, OPTIONS) and
   * token validation for state-changing methods (POST, PUT, DELETE, etc.).
   *
   * The method:
   * 1. Extracts request data using the framework adapter
   * 2. Checks if the request should be excluded or skipped
   * 3. For safe methods: generates and sets new CSRF tokens
   * 4. For unsafe methods: validates existing tokens using the configured strategy
   * 5. Applies response data (headers, cookies) using the adapter
   *
   * @param request - Framework-specific request object
   * @param response - Framework-specific response object
   * @returns Promise resolving to protection result with success status and modified response
   *
   * @example
   * ```typescript
   * // Basic usage in middleware
   * const result = await csrf.protect(req, res);
   * if (!result.success) {
   *   return res.status(403).json({
   *     error: 'CSRF validation failed',
   *     reason: result.reason
   *   });
   * }
   *
   * // Token is available for safe methods
   * if (result.token) {
   *   console.log('Generated CSRF token:', result.token);
   * }
   *
   * // Continue with the modified response
   * return result.response;
   * ```
   *
   * @example
   * ```typescript
   * // Error handling with specific reasons
   * const result = await csrf.protect(req, res);
   * if (!result.success) {
   *   switch (result.reason) {
   *     case 'Invalid token':
   *       return res.status(403).json({ error: 'CSRF token is invalid' });
   *     case 'Token expired':
   *       return res.status(403).json({ error: 'CSRF token has expired' });
   *     case 'Origin mismatch':
   *       return res.status(403).json({ error: 'Request origin not allowed' });
   *     default:
   *       return res.status(403).json({ error: 'CSRF validation failed' });
   *   }
   * }
   * ```
   */
  async protect(
    request: TRequest,
    response: TResponse
  ): Promise<{
    success: boolean;
    response: TResponse;
    token?: string;
    reason?: string;
  }> {
    const csrfRequest = this.adapter.extractRequest(request);

    // Check if request should be skipped
    if (this.shouldSkipProtection(csrfRequest)) {
      return { success: true, response };
    }

    // Attempt to reuse existing tokens or generate new ones
    let tokenData = await this.attemptTokenReuse(csrfRequest);
    tokenData ??= await this.generateTokensForStrategy();

    // Build CSRF response
    const csrfResponse = this.buildCsrfResponse(tokenData);

    // Apply response modifications
    const modifiedResponse = this.adapter.applyResponse(response, csrfResponse);

    // Skip validation for safe methods
    if (
      SAFE_METHODS.includes(csrfRequest.method as (typeof SAFE_METHODS)[number])
    ) {
      return {
        success: true,
        response: modifiedResponse,
        token: tokenData.clientToken,
      };
    }

    // Validate based on strategy
    const validationResult = await validateRequest(
      csrfRequest,
      this.config,
      this.adapter.getTokenFromRequest
    );

    if (!validationResult.isValid) {
      return {
        success: false,
        response: modifiedResponse,
        reason: validationResult.reason ?? 'CSRF Validation failed',
      };
    }

    return {
      success: true,
      response: modifiedResponse,
      token: tokenData.clientToken,
    };
  }

  private async generateTokensForStrategy(): Promise<TokenData> {
    const baseOptions = this.config.cookie;

    switch (this.config.strategy) {
      case 'double-submit': {
        const token = generateNonce(DEFAULT_NONCE_LENGTH);
        if (!token) {
          throw new Error(
            'CSRF Error: Failed to generate nonce for strategy "double-submit".'
          );
        }
        return {
          clientToken: token,
          cookieToken: token,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case 'signed-double-submit': {
        const unsignedToken = generateNonce(DEFAULT_NONCE_LENGTH);
        if (!unsignedToken) {
          throw new Error(
            'CSRF Error: Failed to generate nonce for strategy "signed-double-submit".'
          );
        }
        const signedToken = await signUnsignedToken(
          unsignedToken,
          this.config.secret
        );
        return {
          clientToken: unsignedToken,
          cookieToken: unsignedToken,
          serverCookieToken: signedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case 'signed-token':
      case 'hybrid': {
        const signedToken = await generateSignedToken(
          this.config.secret,
          this.config.token.expiry
        );
        return {
          clientToken: signedToken,
          cookieToken: signedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case 'origin-check': {
        const nonce = generateNonce(ORIGIN_CHECK_NONCE_LENGTH);
        if (!nonce) {
          throw new Error(
            'CSRF Error: Failed to generate nonce for strategy "origin-check".'
          );
        }
        return {
          clientToken: nonce,
          cookieToken: nonce,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      default: {
        throw new Error(`Unknown CSRF strategy: ${this.config.strategy}`);
      }
    }
  }
}

/**
 * Factory function to create a CSRF protection instance.
 *
 * Convenient alternative to using the CsrfProtection constructor directly.
 * This function is the recommended way to create CSRF protection instances
 * as it provides better type inference and a cleaner API.
 *
 * @public
 * @template TRequest - Framework-specific request type
 * @template TResponse - Framework-specific response type
 * @param adapter - Framework adapter implementing CsrfAdapter interface
 * @param config - Optional CSRF configuration (uses secure defaults if not provided)
 * @returns Configured CSRF protection instance ready for use
 *
 * @example
 * ```typescript
 * import { createCsrfProtection } from '@csrf-armor/core';
 * import { ExpressAdapter } from '@csrf-armor/express';
 *
 * // Basic setup with defaults
 * const csrf = createCsrfProtection(new ExpressAdapter());
 *
 * // Custom configuration
 * const csrf = createCsrfProtection(new ExpressAdapter(), {
 *   strategy: 'signed-double-submit',
 *   secret: process.env.CSRF_SECRET,
 *   token: {
 *     expiry: 7200, // 2 hours
 *     fieldName: 'authenticity_token'
 *   },
 *   excludePaths: ['/api/public'],
 *   allowedOrigins: ['https://yourdomain.com']
 * });
 *
 * // Use in middleware
 * app.use(async (req, res, next) => {
 *   const result = await csrf.protect(req, res);
 *   if (result.success) {
 *     next();
 *   } else {
 *     res.status(403).json({ error: result.reason });
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Framework-specific usage
 *
 * // Express.js
 * import { ExpressAdapter } from '@csrf-armor/express';
 * const expressCsrf = createCsrfProtection(new ExpressAdapter(), config);
 *
 * // Next.js
 * import { NextjsAdapter } from '@csrf-armor/nextjs';
 * const nextCsrf = createCsrfProtection(new NextjsAdapter(), config);
 *
 * // Custom framework
 * class MyAdapter implements CsrfAdapter<MyRequest, MyResponse> {
 *   // Implementation...
 * }
 * const customCsrf = createCsrfProtection(new MyAdapter(), config);
 * ```
 */
export function createCsrfProtection<TRequest = unknown, TResponse = unknown>(
  adapter: CsrfAdapter<TRequest, TResponse>,
  config?: CsrfConfig
): CsrfProtection<TRequest, TResponse> {
  return new CsrfProtection(adapter, config);
}
