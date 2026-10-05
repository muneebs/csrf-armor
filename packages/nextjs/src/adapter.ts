import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Whether a FormData key is `fieldName` as React encodes it for a server
 * action submitted with JavaScript. React prefixes each field of a FormData
 * argument with `_<n>_` (for example `_1_csrf_token`).
 */
function isServerActionField(key: string, fieldName: string): boolean {
  return /^_\d+_/.test(key) && key.slice(key.indexOf('_', 1) + 1) === fieldName;
}

/**
 * Parses a text/plain body as server action arguments (a JSON array).
 * Returns null when the body is not a non-empty JSON array.
 */
function parseServerActionArgs(body: string): unknown[] | null {
  if (!body.startsWith('[')) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

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

    // 2. Try query parameter
    if (request.url) {
      try {
        const url = new URL(request.url, 'http://localhost');
        const queryValue = url.searchParams.get(config.token.fieldName);
        if (queryValue) return queryValue;
      } catch {
        // If URL parsing fails, skip query parameter extraction
      }
    }

    // 3. Attempt to get parsed body from cache or parse it once
    let parsedBody: unknown;
    if (this.parsedBodyCache.has(nextRequest)) {
      parsedBody = this.parsedBodyCache.get(nextRequest);
    } else {
      // Compare the bare media type: parameters such as `charset` and the
      // header's casing must not change how the body is parsed.
      const contentType = headers.get('content-type') ?? 'text/plain';
      const mediaType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
      try {
        if (nextRequest.bodyUsed) {
          console.warn(
            'Request body was already consumed externally. CSRF token might not be extractable from body.'
          );
          parsedBody = null;
        } else if (
          mediaType === 'application/x-www-form-urlencoded' ||
          mediaType === 'multipart/form-data'
        ) {
          parsedBody = await nextRequest.formData();
        } else if (
          mediaType === 'application/json' ||
          mediaType === 'application/ld+json'
        ) {
          parsedBody = await nextRequest.json();
        } else if (mediaType === 'text/plain') {
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
        if (
          key === config.token.fieldName ||
          isServerActionField(key, config.token.fieldName)
        ) {
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
      // Server actions called from client code send their arguments as a
      // JSON array with a text/plain content type.
      const actionArgs = parseServerActionArgs(parsedBody);
      if (actionArgs) {
        return this.extractTokenFromServerActionArgs(actionArgs, config);
      }

      try {
        // Try to parse as URL-encoded form data
        const params = new URLSearchParams(parsedBody);
        const tokenValue = params.get(config.token.fieldName);
        if (tokenValue) {
          return tokenValue;
        }
      } catch (error) {
        // If parsing fails, we can't extract the token from the string
        console.warn(
          'Failed to parse string body as URL-encoded form data',
          error
        );
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
