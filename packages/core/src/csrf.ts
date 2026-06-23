import {
  CSRF_STRATEGY_HEADER,
  CSRF_TOKEN_HEADER,
  DEFAULT_CONFIG,
  DEFAULT_NONCE_LENGTH,
  DEFAULT_ROTATION_GRACE_PERIOD,
  HOST_COOKIE_PREFIX,
  ORIGIN_CHECK_NONCE_LENGTH,
  SAFE_METHODS,
  SERVER_CSRF_COOKIE_SUFFIX,
} from './constants.js';
import {
  assertWebCrypto,
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  timingSafeEqual,
  verifySignedToken,
} from './crypto.js';
import { WeakSecretError } from './errors.js';
import type {
  CsrfAdapter,
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  OnFailureContext,
  RequiredCookieOptions,
  RequiredCsrfConfig,
  ValidationResult,
} from './types.js';
import { getCookies, validateRequest } from './validation.js';

/** Extracts the pathname from a URL string for path-based exclusion matching. */
function extractPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const questionMarkIndex = url.indexOf('?');
    if (questionMarkIndex !== -1) {
      return url.substring(0, questionMarkIndex);
    }
    return url;
  }
}

/** Normalizes a path for excludePaths matching. */
function normalizePath(path: string): string {
  try {
    return decodeURIComponent(path).replace(/\/+/g, '/');
  } catch {
    return path.replace(/\/+/g, '/');
  }
}

function processHeaders(
  rawHeaders: CsrfRequest['headers']
): Map<string, string> {
  if (rawHeaders instanceof Map) {
    return rawHeaders;
  }

  if (rawHeaders instanceof Headers) {
    const map = new Map<string, string>();
    for (const [key, value] of rawHeaders.entries()) {
      map.set(key.toLowerCase(), value);
    }
    return map;
  }

  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value !== undefined) {
      map.set(key.toLowerCase(), String(value));
    }
  }
  return map;
}

function parseMediaType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

function mergeConfig(
  defaultConfig: CsrfConfig,
  userConfig?: CsrfConfig
): RequiredCsrfConfig {
  const mergedCookie = {
    ...defaultConfig.cookie,
    ...userConfig?.cookie,
  };

  const hostCookiePrefix = userConfig?.hostCookiePrefix ?? false;
  if (hostCookiePrefix) {
    const baseName = mergedCookie.name ?? 'csrf-token';
    mergedCookie.name = `${HOST_COOKIE_PREFIX}${baseName}`;
    mergedCookie.secure = true;
    mergedCookie.path = '/';
    delete mergedCookie.domain;
  }

  const mergedToken = {
    ...defaultConfig.token,
    ...userConfig?.token,
  };

  const contentType = {
    ...defaultConfig.contentType,
    ...userConfig?.contentType,
    allowedTypes: [
      ...(defaultConfig.contentType?.allowedTypes ?? []),
      ...(userConfig?.contentType?.allowedTypes ?? []),
    ],
    skipValidation: [
      ...(defaultConfig.contentType?.skipValidation ?? []),
      ...(userConfig?.contentType?.skipValidation ?? []),
    ],
  };

  const config: RequiredCsrfConfig = {
    strategy: userConfig?.strategy ?? defaultConfig.strategy ?? 'hybrid',
    secret:
      userConfig?.secret ?? defaultConfig.secret ?? generateSecureSecret(),
    previousSecrets: userConfig?.previousSecrets ?? [],
    token: {
      expiry: mergedToken.expiry ?? 3600,
      headerName: mergedToken.headerName ?? 'X-CSRF-Token',
      fieldName: mergedToken.fieldName ?? 'csrf_token',
      reissueThreshold: mergedToken.reissueThreshold ?? 500,
    },
    cookie: {
      name: mergedCookie.name ?? 'csrf-token',
      secure: mergedCookie.secure ?? true,
      httpOnly: mergedCookie.httpOnly ?? false,
      sameSite: mergedCookie.sameSite ?? 'lax',
      path: mergedCookie.path ?? '/',
    },
    allowedOrigins: userConfig?.allowedOrigins ?? [],
    excludePaths: userConfig?.excludePaths ?? [],
    contentType: {
      enforcePresence: contentType.enforcePresence ?? false,
      allowedTypes: contentType.allowedTypes,
      skipValidation: contentType.skipValidation,
    },
    hostCookiePrefix,
    rotateOnUse: userConfig?.rotateOnUse ?? false,
    getSessionId: userConfig?.getSessionId,
    logger: userConfig?.logger,
    metrics: userConfig?.metrics,
    onFailure: userConfig?.onFailure,
  };

  if (mergedCookie.domain && !hostCookiePrefix) {
    config.cookie.domain = mergedCookie.domain;
  }
  if (mergedCookie.maxAge !== undefined) {
    config.cookie.maxAge = mergedCookie.maxAge;
  }

  return config;
}

interface TokenData {
  clientToken: string;
  cookieToken: string;
  serverCookieToken?: string;
  cookieOptions: RequiredCookieOptions;
}

export class CsrfProtection<TRequest = unknown, TResponse = unknown> {
  private readonly config: RequiredCsrfConfig;
  private readonly adapter: CsrfAdapter<TRequest, TResponse>;
  private readonly rotationCache = new Map<string, number>();

  constructor(
    adapter: CsrfAdapter<TRequest, TResponse>,
    userConfig?: CsrfConfig
  ) {
    assertWebCrypto();
    this.adapter = adapter;

    if (!userConfig?.secret && !DEFAULT_CONFIG.secret) {
      console.warn(
        '[@csrf-armor] No CSRF secret provided; a random secret was generated. Set a persistent secret in production or tokens will be invalidated on restart.'
      );
    }

    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);

    if (this.config.secret.length < 32) {
      throw new WeakSecretError();
    }

    for (const previous of this.config.previousSecrets) {
      if (previous.length < 32) {
        throw new WeakSecretError();
      }
    }
  }

  private shouldSkipProtection(request: CsrfRequest): boolean {
    const pathname = normalizePath(extractPathname(request.url));

    for (const excluded of this.config.excludePaths) {
      const normalizedExcluded = normalizePath(excluded);
      if (
        pathname === normalizedExcluded ||
        (normalizedExcluded.endsWith('/') &&
          pathname.startsWith(normalizedExcluded)) ||
        pathname === `${normalizedExcluded}/`
      ) {
        return true;
      }
    }

    const headers = processHeaders(request.headers);
    const contentType = parseMediaType(headers.get('content-type') ?? '');
    const skipList = this.config.contentType.skipValidation ?? [];
    return skipList.some((type) => contentType === parseMediaType(type));
  }

  private async attemptTokenReuse(
    request: CsrfRequest
  ): Promise<TokenData | null> {
    const method = request.method.toUpperCase();
    if (!SAFE_METHODS.includes(method)) {
      return null;
    }

    const cookies = getCookies(request);

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
        case 'hybrid':
        case 'fetch-metadata': {
          const payload = await parseSignedToken(
            clientTokenFromRequest,
            this.config.secret,
            this.config.previousSecrets
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
                this.config.secret,
                this.config.previousSecrets
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

        case 'origin-check': {
          if (clientTokenFromRequest.length >= ORIGIN_CHECK_NONCE_LENGTH / 2) {
            return {
              clientToken: clientTokenFromRequest,
              cookieToken: clientTokenFromRequest,
              cookieOptions: { ...this.config.cookie, httpOnly: false },
            };
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private buildCsrfResponse(tokenData: TokenData): CsrfResponse {
    const cookies = new Map<
      string,
      { value: string; options?: RequiredCookieOptions }
    >([
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
      headers: new Map<string, string>([
        [CSRF_TOKEN_HEADER, tokenData.clientToken],
        [CSRF_STRATEGY_HEADER, this.config.strategy],
      ]),
      cookies,
    };
  }

  private async getSessionId(
    request: CsrfRequest
  ): Promise<string | undefined> {
    if (!this.config.getSessionId) return undefined;
    const result = await this.config.getSessionId(request);
    return result;
  }

  private async generateTokensForStrategy(
    sessionId?: string
  ): Promise<TokenData> {
    const baseOptions = this.config.cookie;

    switch (this.config.strategy) {
      case 'signed-double-submit': {
        const unsignedToken = generateNonce(DEFAULT_NONCE_LENGTH);
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
      case 'hybrid':
      case 'fetch-metadata': {
        const signedToken = await generateSignedToken(
          this.config.secret,
          this.config.token.expiry,
          sessionId
        );
        return {
          clientToken: signedToken,
          cookieToken: signedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case 'origin-check': {
        const nonce = generateNonce(ORIGIN_CHECK_NONCE_LENGTH);
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

  private log(
    level: 'warn' | 'error',
    message: string,
    context: Record<string, unknown> | OnFailureContext
  ): void {
    if (!this.config.logger) return;
    if (level === 'warn') {
      this.config.logger.warn(message, context);
    } else {
      this.config.logger.error(message, context);
    }
  }

  private reportMetric(
    event: 'accept' | 'reject' | 'rotated',
    context: Record<string, unknown>
  ): void {
    if (!this.config.metrics) return;
    if (event === 'accept') {
      this.config.metrics.onAccept(context);
    } else if (event === 'reject') {
      this.config.metrics.onReject(context);
    } else {
      this.config.metrics.onTokenRotated(context);
    }
  }

  private async invokeOnFailure(context: OnFailureContext): Promise<void> {
    try {
      await this.config.onFailure?.(context);
    } catch (error) {
      this.log('error', 'onFailure hook threw an error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isRotatedTokenValid(token: string): boolean {
    const expiry = this.rotationCache.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.rotationCache.delete(token);
      return false;
    }
    return true;
  }

  private pruneRotationCache(): void {
    const now = Date.now();
    for (const [token, expiry] of this.rotationCache.entries()) {
      if (now > expiry) {
        this.rotationCache.delete(token);
      }
    }
  }

  private async validateWithRotationGrace(
    csrfRequest: CsrfRequest,
    sessionId?: string
  ): Promise<ValidationResult> {
    this.pruneRotationCache();

    const token = await this.adapter.getTokenFromRequest(
      csrfRequest,
      this.config
    );
    if (token && this.isRotatedTokenValid(token)) {
      return { isValid: true };
    }

    return validateRequest(
      csrfRequest,
      this.config,
      this.adapter.getTokenFromRequest,
      sessionId
    );
  }

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
    csrfRequest.method = csrfRequest.method.toUpperCase();

    if (this.shouldSkipProtection(csrfRequest)) {
      return { success: true, response };
    }

    const method = csrfRequest.method;
    const pathname = extractPathname(csrfRequest.url);

    if (SAFE_METHODS.includes(method)) {
      let tokenData = await this.attemptTokenReuse(csrfRequest);
      const sessionId = await this.getSessionId(csrfRequest);
      tokenData ??= await this.generateTokensForStrategy(sessionId);

      const csrfResponse = this.buildCsrfResponse(tokenData);
      const modifiedResponse = this.adapter.applyResponse(
        response,
        csrfResponse
      );

      this.reportMetric('accept', {
        strategy: this.config.strategy,
        method,
        path: pathname,
      });

      return {
        success: true,
        response: modifiedResponse,
        token: tokenData.clientToken,
      };
    }

    // Unsafe methods: validate BEFORE applying any tokens to the response.
    const sessionId = await this.getSessionId(csrfRequest);
    const validationResult = this.config.rotateOnUse
      ? await this.validateWithRotationGrace(csrfRequest, sessionId)
      : await validateRequest(
          csrfRequest,
          this.config,
          this.adapter.getTokenFromRequest,
          sessionId
        );

    if (!validationResult.isValid) {
      const failureContext: OnFailureContext = {
        strategy: this.config.strategy,
        method,
        path: pathname,
        reason: validationResult.reason ?? 'CSRF validation failed',
        origin: processHeaders(csrfRequest.headers).get('origin'),
        secFetchSite: processHeaders(csrfRequest.headers).get('sec-fetch-site'),
      };

      this.log('warn', 'CSRF validation rejected request', failureContext);
      this.reportMetric('reject', {
        strategy: this.config.strategy,
        method,
        path: pathname,
        reason: validationResult.reason ?? 'CSRF validation failed',
      });
      await this.invokeOnFailure(failureContext);

      return {
        success: false,
        response,
        reason: validationResult.reason ?? 'CSRF validation failed',
      };
    }

    // Validation succeeded: now generate/rotate tokens and apply them.
    const tokenData = await this.generateTokensForStrategy(sessionId);

    if (this.config.rotateOnUse) {
      const previousToken = await this.adapter.getTokenFromRequest(
        csrfRequest,
        this.config
      );
      if (previousToken) {
        this.rotationCache.set(
          previousToken,
          Date.now() + DEFAULT_ROTATION_GRACE_PERIOD * 1000
        );
      }
      this.reportMetric('rotated', {
        strategy: this.config.strategy,
        path: pathname,
      });
    }

    const csrfResponse = this.buildCsrfResponse(tokenData);
    const modifiedResponse = this.adapter.applyResponse(response, csrfResponse);

    this.reportMetric('accept', {
      strategy: this.config.strategy,
      method,
      path: pathname,
    });

    return {
      success: true,
      response: modifiedResponse,
      token: tokenData.clientToken,
    };
  }
}

/**
 * Factory function to create a CSRF protection instance.
 *
 * @public
 */
export function createCsrfProtection<TRequest = unknown, TResponse = unknown>(
  adapter: CsrfAdapter<TRequest, TResponse>,
  config?: CsrfConfig
): CsrfProtection<TRequest, TResponse> {
  return new CsrfProtection(adapter, config);
}
