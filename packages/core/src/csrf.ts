import { DEFAULT_CONFIG, SAFE_METHODS } from './constants.js';
import {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  signUnsignedToken,
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

function processHeaders(
  rawHeaders: CsrfRequest['headers']
): Map<string, string> {
  if (rawHeaders instanceof Map) {
    return rawHeaders;
  }

  // Simple conversion without string pooling
  return new Map(Object.entries(rawHeaders));
}

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
      expiry: userConfig?.token?.expiry ?? defaultConfig.token?.expiry ?? 3600,
      headerName:
        userConfig?.token?.headerName ??
        defaultConfig.token?.headerName ??
        'X-CSRF-Token',
      fieldName:
        userConfig?.token?.fieldName ??
        defaultConfig.token?.fieldName ??
        'csrf_token',
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

export class CsrfProtection<TRequest = unknown, TResponse = unknown> {
  private readonly config: RequiredCsrfConfig;
  private readonly adapter: CsrfAdapter<TRequest, TResponse>;

  constructor(
    adapter: CsrfAdapter<TRequest, TResponse>,
    userConfig?: CsrfConfig
  ) {
    this.adapter = adapter;
    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
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

    const pathname = extractPathname(csrfRequest.url);
    if (this.config.excludePaths.some((path) => pathname.startsWith(path))) {
      return { success: true, response };
    }

    const headers = processHeaders(csrfRequest.headers);
    const contentType = headers.get('content-type') ?? '';
    if (
      this.config.skipContentTypes.some((type) => contentType.includes(type))
    ) {
      return { success: true, response };
    }

    const tokenData = await this.generateTokensForStrategy();

    // Create CSRF response
    const csrfResponse: CsrfResponse = {
      headers: new Map([
        ['x-csrf-token', tokenData.clientToken],
        // Add strategy hint for client
        ['x-csrf-strategy', this.config.strategy],
      ]),
      cookies: (() => {
        const cookiesMap = new Map([
          [
            this.config.cookie.name,
            {
              value: tokenData.cookieToken,
              options: tokenData.cookieOptions,
            },
          ],
        ]);

        if (tokenData.serverCookieToken) {
          cookiesMap.set(`${this.config.cookie.name}-server`, {
            value: tokenData.serverCookieToken,
            options: {
              ...tokenData.cookieOptions,
              httpOnly: true, // Server-only
            },
          });
        }

        return cookiesMap;
      })(),
    };

    // Apply response modifications
    const modifiedResponse = this.adapter.applyResponse(response, csrfResponse);

    // Skip validation for safe methods
    if (SAFE_METHODS.includes(csrfRequest.method as never)) {
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

  private async generateTokensForStrategy(): Promise<{
    clientToken: string;
    cookieToken: string;
    serverCookieToken?: string;
    cookieOptions: RequiredCookieOptions;
  }> {
    const baseOptions = this.config.cookie;

    switch (this.config.strategy) {
      case 'double-submit': {
        const unsignedToken = generateNonce(32);
        return {
          clientToken: unsignedToken,
          cookieToken: unsignedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case 'signed-double-submit': {
        const unsignedToken = generateNonce(32);
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
        const nonce = generateNonce(16);
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

export function createCsrfProtection<TRequest = unknown, TResponse = unknown>(
  adapter: CsrfAdapter<TRequest, TResponse>,
  config?: CsrfConfig
): CsrfProtection<TRequest, TResponse> {
  return new CsrfProtection(adapter, config);
}
