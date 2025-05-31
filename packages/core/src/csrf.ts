import type {
  CsrfConfig,
  RequiredCsrfConfig,
  CsrfResponse,
  CsrfAdapter,
  RequiredCookieOptions,
} from "./types.js";
import { DEFAULT_CONFIG, SAFE_METHODS } from "./constants.js";
import {
  generateSignedToken,
  generateNonce,
  signUnsignedToken,
  generateSecureSecret,
} from "./crypto.js";
import { validateRequest } from "./validation.js";
function mergeConfig(
  defaultConfig: CsrfConfig,
  userConfig?: CsrfConfig,
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
    strategy: userConfig?.strategy ?? defaultConfig.strategy ?? "hybrid",
    secret:
      userConfig?.secret ?? defaultConfig.secret ?? generateSecureSecret(),
    token: {
      expiry: userConfig?.token?.expiry ?? defaultConfig.token?.expiry ?? 3600,
      headerName:
        userConfig?.token?.headerName ??
        defaultConfig.token?.headerName ??
        "X-CSRF-Token",
      fieldName:
        userConfig?.token?.fieldName ??
        defaultConfig.token?.fieldName ??
        "csrf_token",
    },
    cookie: {
      name: merged.cookie?.name ?? "csrf-token",
      secure: merged.cookie?.secure ?? true,
      httpOnly: merged.cookie?.httpOnly ?? false,
      sameSite: merged.cookie?.sameSite ?? "lax",
      path: merged.cookie?.path ?? "/",
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
    userConfig?: CsrfConfig,
  ) {
    this.adapter = adapter;
    this.config = mergeConfig(DEFAULT_CONFIG, userConfig);
  }

  async protect(
    request: TRequest,
    response: TResponse,
  ): Promise<{
    success: boolean;
    response: TResponse;
    token?: string;
    reason?: string;
  }> {
    const csrfRequest = this.adapter.extractRequest(request);

    // Check if path is excluded
    const url = new URL(csrfRequest.url);
    const pathname = url.pathname;
    if (this.config.excludePaths.some((path) => pathname.startsWith(path))) {
      return { success: true, response };
    }

    // Check if content type should skip CSRF
    const headers =
      csrfRequest.headers instanceof Map
        ? csrfRequest.headers
        : new Map(Object.entries(csrfRequest.headers));
    const contentType = headers.get("content-type") ?? "";
    if (
      this.config.skipContentTypes.some((type) => contentType.includes(type))
    ) {
      return { success: true, response };
    }

    const tokenData = await this.generateTokensForStrategy();

    // Create CSRF response
    const csrfResponse: CsrfResponse = {
      headers: new Map([
        ["x-csrf-token", tokenData.clientToken],
        // Add strategy hint for client
        ["x-csrf-strategy", this.config.strategy],
      ]),
      cookies: new Map([
        [
          this.config.cookie.name,
          {
            value: tokenData.cookieToken,
            options: tokenData.cookieOptions,
          },
        ],
        ...(tokenData.serverCookieToken
          ? new Map([
              [
                `${this.config.cookie.name}-server`,
                {
                  value: tokenData.serverCookieToken,
                  options: {
                    ...tokenData.cookieOptions,
                    httpOnly: true, // Server-only
                  },
                },
              ],
            ])
          : new Map()),
      ]),
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
      this.adapter.getTokenFromRequest,
    );

    if (!validationResult.isValid) {
      return {
        success: false,
        response: modifiedResponse,
        reason: validationResult.reason ?? "CSRF Validation failed",
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
      case "double-submit": {
        // Simple double-submit: same unsigned token everywhere
        const unsignedToken = generateNonce(32);
        return {
          clientToken: unsignedToken,
          cookieToken: unsignedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case "signed-double-submit": {
        // Signed double-submit: unsigned for client, signed for server validation
        const unsignedToken = generateNonce(32);
        const signedToken = await signUnsignedToken(
          unsignedToken,
          this.config.secret,
        );

        return {
          clientToken: unsignedToken, // Client uses unsigned token
          cookieToken: unsignedToken, // Client-accessible cookie has unsigned token
          serverCookieToken: signedToken, // Server-only cookie has signed token
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case "signed-token":
      case "hybrid": {
        // Signed strategies: use signed token
        const signedToken = await generateSignedToken(
          this.config.secret,
          this.config.token.expiry,
        );
        return {
          clientToken: signedToken,
          cookieToken: signedToken,
          cookieOptions: { ...baseOptions, httpOnly: false },
        };
      }

      case "origin-check": {
        // Origin-only: minimal token needed
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
  config?: CsrfConfig,
): CsrfProtection<TRequest, TResponse> {
  return new CsrfProtection(adapter, config);
}
