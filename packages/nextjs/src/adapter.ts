import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { NextRequest, NextResponse } from 'next/server';

export class NextjsAdapter implements CsrfAdapter<NextRequest, NextResponse> {
  private readonly parsedBodyCache = new WeakMap<NextRequest, unknown>();

  constructor() {
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  extractRequest(req: NextRequest): CsrfRequest {
    const cookies = new Map<string, string>();
    for (const { name, value } of req.cookies.getAll()) {
      cookies.set(name, value);
    }

    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
      cookies,
      body: req,
    };
  }

  applyResponse(res: NextResponse, csrfResponse: CsrfResponse): NextResponse {
    if (csrfResponse.headers instanceof Map) {
      for (const [key, value] of csrfResponse.headers) {
        res.headers.set(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(csrfResponse.headers)) {
        res.headers.set(key, String(value));
      }
    }

    if (csrfResponse.cookies instanceof Map) {
      for (const [name, cookieData] of csrfResponse.cookies) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    } else {
      for (const [name, cookieData] of Object.entries(csrfResponse.cookies)) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    }

    return res;
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers = request.headers as Headers;
    const nextRequest = request.body as NextRequest;

    // 1. Try header first
    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    // 2. Try cookie
    const clientCookieValue = nextRequest.cookies?.get(
      config.cookie.name.toLowerCase()
    )?.value;
    if (clientCookieValue) return clientCookieValue;

    // 3. Attempt to get parsed body from cache or parse it once
    let parsedBody: unknown;
    if (this.parsedBodyCache.has(nextRequest)) {
      parsedBody = this.parsedBodyCache.get(nextRequest);
    } else {
      const contentType = headers.get('content-type') ?? 'text/plain';
      try {
        if (nextRequest.bodyUsed) {
          console.warn(
            'Request body was already consumed externally. CSRF token might not be extractable from body.'
          );
          parsedBody = null;
        } else if (
          contentType.startsWith('application/x-www-form-urlencoded') ||
          contentType.startsWith('multipart/form-data')
        ) {
          parsedBody = await nextRequest.formData();
        } else if (
          contentType === 'application/json' ||
          contentType === 'application/ld+json'
        ) {
          parsedBody = await nextRequest.json();
        } else if (contentType.startsWith('text/plain')) {
          parsedBody = await nextRequest.text();
        } else {
          parsedBody = null;
        }
        this.parsedBodyCache.set(nextRequest, parsedBody);
      } catch (error) {
        console.warn(
          'Failed to parse request body for CSRF token extraction',
          error
        );
        this.parsedBodyCache.set(nextRequest, null);
        parsedBody = null;
      }
    }

    // 4. Extract token from the parsed body
    if (parsedBody instanceof FormData) {
      for (const [key, value] of parsedBody.entries()) {
        if (key === config.token.fieldName) {
          return value.toString();
        }
      }
    } else if (parsedBody && typeof parsedBody === 'object') {
      const jsonVal = (parsedBody as Record<string, unknown>)[
        config.token.fieldName
      ];
      if (typeof jsonVal === 'string') return jsonVal;

      if (Array.isArray(parsedBody) && parsedBody.length > 0) {
        return this.extractTokenFromServerActionArgs(parsedBody, config);
      }
    } else if (typeof parsedBody === 'string') {
      try {
        // Try to parse as URL-encoded form data
        const params = new URLSearchParams(parsedBody);
        const tokenValue = params.get(config.token.fieldName);
        if (tokenValue) {
          return tokenValue;
        }
      } catch (error) {
        // If parsing fails, we can't extract the token from the string
        console.warn('Failed to parse string body as URL-encoded form data', error);
      }
    }

    return undefined;
  }

  private extractTokenFromServerActionArgs(
    args: unknown[],
    config: RequiredCsrfConfig
  ): string | undefined {
    const firstArg = args[0];

    // First argument is a string (direct token)
    if (typeof firstArg === 'string') {
      return firstArg;
    }

    // First argument is an object containing the token
    if (firstArg && typeof firstArg === 'object') {
      const token = (firstArg as Record<string, unknown>)[
        config.token.fieldName
      ];
      if (typeof token === 'string') {
        return token;
      }
    }

    // Search through all arguments for a token field
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        const token = (arg as Record<string, unknown>)[config.token.fieldName];
        if (typeof token === 'string') {
          return token;
        }
      }
    }

    // No token found in arguments
    return undefined;
  }

  private adaptCookieOptions(options?: CookieOptions): Record<string, unknown> {
    if (!options) return {};

    return {
      secure: options.secure,
      httpOnly: options.httpOnly,
      sameSite: options.sameSite,
      path: options.path,
      domain: options.domain,
      maxAge: options.maxAge,
    };
  }
}
