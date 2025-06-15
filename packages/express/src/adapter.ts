import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type express from 'express';

/**
 * Express.js adapter for CSRF protection.
 *
 * This adapter implements the CsrfAdapter interface to provide CSRF protection
 * for Express.js applications. It handles request/response transformation,
 * token extraction from various sources, and cookie/header management.
 *
 * @example
 * ```typescript
 * import { CsrfProtection } from '@csrf-armor/core';
 * import { ExpressAdapter } from '@csrf-armor/express';
 *
 * const csrf = new CsrfProtection(new ExpressAdapter(), {
 *   secret: 'your-secret-key',
 *   strategy: 'signed-double-submit'
 * });
 * ```
 */
export class ExpressAdapter
  implements CsrfAdapter<express.Request, express.Response>
{
  /**
   * Extracts CSRF-relevant data from an Express.js request.
   *
   * Converts an Express Request object into a standardized CsrfRequest format
   * that can be processed by the core CSRF protection logic. Handles header
   * normalization, cookie extraction, and body access.
   *
   * @param req - Express.js request object
   * @returns Normalized CSRF request object
   *
   * @example
   * ```typescript
   * const adapter = new ExpressAdapter();
   * const csrfRequest = adapter.extractRequest(req);
   * // csrfRequest contains normalized headers, cookies, and body
   * ```
   */
  extractRequest(req: express.Request): CsrfRequest {
    // Create a Map for headers with proper type handling
    const headers = new Map<string, string>();

    // Safely process headers, handling string, string[], and undefined values
    if (req.headers) {
      Object.entries(req.headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // Join array values into a single string
          headers.set(key.toLowerCase(), value.join(', '));
        } else if (value !== undefined) {
          // Set string values directly
          headers.set(key.toLowerCase(), value);
        }
        // Skip undefined values
      });
    }

    return {
      method: req.method,
      url: req.url,
      headers,
      cookies: new Map(Object.entries(req.cookies ?? {})),
      body: req.body,
    };
  }

  /**
   * Sets a cookie on the Express.js response with CSRF protection options.
   *
   * Converts CSRF armor cookie options to Express.js cookie format,
   * including proper maxAge conversion (seconds to milliseconds).
   *
   * @param res - Express.js response object
   * @param name - Cookie name
   * @param value - Cookie value
   * @param options - CSRF cookie options
   *
   * @private
   */
  private setCookie(
    res: express.Response,
    name: string,
    value: string,
    options?: CookieOptions
  ): void {
    res.cookie(name, value, {
      secure: options?.secure,
      httpOnly: options?.httpOnly,
      sameSite: options?.sameSite,
      path: options?.path,
      domain: options?.domain,
      maxAge: options?.maxAge ? options.maxAge * 1000 : undefined, // Express expects milliseconds
    });
  }

  /**
   * Sets HTTP headers on the Express.js response.
   *
   * Handles both Map and object-based header formats from the CSRF response.
   *
   * @param res - Express.js response object
   * @param headers - Headers to set (Map or object format)
   *
   * @private
   */
  private setHeaders(
    res: express.Response,
    headers: CsrfResponse['headers']
  ): void {
    const entries =
      headers instanceof Map ? headers : Object.entries(headers || {});
    for (const [key, value] of entries) {
      res.setHeader(key, value);
    }
  }

  /**
   * Applies CSRF protection data to an Express.js response.
   *
   * Sets headers and cookies on the Express response based on the CSRF
   * protection results. This includes CSRF tokens, strategy hints, and
   * security cookies.
   *
   * @param res - Express.js response object to modify
   * @param csrfResponse - CSRF response data containing headers and cookies
   * @returns The modified Express.js response object
   *
   * @example
   * ```typescript
   * const adapter = new ExpressAdapter();
   * const modifiedResponse = adapter.applyResponse(res, {
   *   headers: new Map([['x-csrf-token', 'abc123']]),
   *   cookies: new Map([['csrf-token', { value: 'def456', options: { httpOnly: true } }]])
   * });
   * ```
   */
  applyResponse(
    res: express.Response,
    csrfResponse: CsrfResponse
  ): express.Response {
    this.setHeaders(res, csrfResponse.headers);

    if (csrfResponse.cookies) {
      const entries =
        csrfResponse.cookies instanceof Map
          ? Array.from(csrfResponse.cookies.entries())
          : Object.entries(csrfResponse.cookies);

      for (const [name, { value, options }] of entries) {
        this.setCookie(res, name, value, options);
      }
    }

    return res;
  }

  /**
   * Extracts CSRF token from various locations in an Express.js request.
   *
   * Attempts to find the CSRF token in the following order:
   * 1. HTTP headers (e.g., X-CSRF-Token)
   * 2. URL query parameters
   * 3. Request body (form data or JSON)
   *
   * This method handles relative URLs safely by providing a base URL for parsing.
   *
   * @param request - Normalized CSRF request object
   * @param config - CSRF configuration containing token field names
   * @returns The extracted token string, or undefined if not found
   *
   * @example
   * ```typescript
   * const adapter = new ExpressAdapter();
   * const token = await adapter.getTokenFromRequest(csrfRequest, {
   *   token: { headerName: 'X-CSRF-Token', fieldName: 'csrf_token' }
   * });
   * // Returns token from header, query param, or body
   * ```
   */
  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers =
      request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers));

    // Try header first (most common for APIs)
    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    // Try cookie
    const cookies =
      request.cookies instanceof Map
        ? request.cookies
        : new Map(Object.entries(request.cookies || {}));
    const cookieValue = cookies.get(config.cookie.name);
    if (cookieValue) return cookieValue;

    // Try query parameter
    if (request.url) {
      try {
        // Express request.url is a relative path, so we need to create a full URL
        const url = new URL(request.url, 'http://localhost');
        const queryValue = url.searchParams.get(config.token.fieldName);
        if (queryValue) return queryValue;
      } catch {
        // If URL parsing fails, skip query parameter extraction
      }
    }

    // Try form body
    if (request.body && typeof request.body === 'object') {
      const body = request.body as Record<string, unknown>;
      const formValue = body[config.token.fieldName];
      if (typeof formValue === 'string') return formValue;
    }

    return undefined;
  }
}
