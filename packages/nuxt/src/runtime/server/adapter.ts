import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { H3Event } from 'h3';
import {
  getHeader,
  getHeaders,
  getMethod,
  getRequestURL,
  parseCookies,
  readBody,
  setCookie,
  setResponseHeader,
} from 'h3';

/**
 * Nuxt adapter for the CSRF protection system.
 *
 * Bridges H3 event objects with the framework-agnostic
 * CSRF protection logic from `@csrf-armor/core`.
 */
export class NuxtAdapter implements CsrfAdapter<H3Event, H3Event> {
  /** Cache parsed bodies to avoid double reads on the same event. */
  private readonly parsedBodyCache = new WeakMap<H3Event, unknown>();

  constructor() {
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  /**
   * Extracts a normalized CSRF request from an H3 event.
   */
  extractRequest(event: H3Event): CsrfRequest {
    const rawCookies = parseCookies(event);
    const cookies = new Map<string, string>();
    for (const [name, value] of Object.entries(rawCookies)) {
      cookies.set(name, value);
    }

    const rawHeaders = getHeaders(event);
    const headers = new Map<string, string>();
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (value !== undefined) {
        headers.set(key, String(value));
      }
    }

    return {
      method: getMethod(event),
      url: getRequestURL(event).href,
      headers,
      cookies,
      body: event,
    };
  }

  /**
   * Applies CSRF response headers and cookies to the H3 event.
   */
  applyResponse(event: H3Event, csrfResponse: CsrfResponse): H3Event {
    if (csrfResponse.headers instanceof Map) {
      for (const [key, value] of csrfResponse.headers) {
        setResponseHeader(event, key, value);
      }
    } else {
      for (const [key, value] of Object.entries(csrfResponse.headers)) {
        setResponseHeader(event, key, String(value));
      }
    }

    if (csrfResponse.cookies instanceof Map) {
      for (const [name, cookieData] of csrfResponse.cookies) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        setCookie(event, name, value, this.adaptCookieOptions(options));
      }
    } else {
      for (const [name, cookieData] of Object.entries(csrfResponse.cookies)) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        setCookie(event, name, value, this.adaptCookieOptions(options));
      }
    }

    return event;
  }

  /**
   * Extracts the CSRF token from the request header, cookie, or body.
   *
   * Priority: header > cookie > body (JSON/FormData/URL-encoded/text).
   */
  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const event = request.body as H3Event;

    // 1. Try header first (h3 normalizes header names to lowercase)
    const headerValue = getHeader(event, config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    // 2. Try cookie (lowercase to align with Express/Next.js adapters)
    const cookies = parseCookies(event);
    const cookieName = config.cookie.name.toLowerCase();
    const clientCookieValue =
      cookies[cookieName] ?? cookies[config.cookie.name];
    if (clientCookieValue) return clientCookieValue;

    // 3. Attempt to get parsed body from cache or parse it once
    let parsedBody: unknown;
    if (this.parsedBodyCache.has(event)) {
      parsedBody = this.parsedBodyCache.get(event);
    } else {
      // Guard: h3 caches parsed bodies internally via _body on the node request.
      // If the body was already read by other middleware, readBody returns the cached result.
      // We still wrap in try/catch to handle edge cases where the stream was consumed externally.
      const contentType = getHeader(event, 'content-type') ?? 'text/plain';
      try {
        if (
          contentType.startsWith('application/x-www-form-urlencoded') ||
          contentType.startsWith('multipart/form-data')
        ) {
          parsedBody = await readBody(event);
        } else if (
          contentType.startsWith('application/json') ||
          contentType.startsWith('application/ld+json')
        ) {
          parsedBody = await readBody(event);
        } else if (contentType.startsWith('text/plain')) {
          parsedBody = await readBody(event);
        } else {
          parsedBody = null;
        }
        this.parsedBodyCache.set(event, parsedBody);
      } catch (error) {
        console.warn(
          'Failed to parse request body for CSRF token extraction',
          error
        );
        this.parsedBodyCache.set(event, null);
        parsedBody = null;
      }
    }

    // 4. Extract token from the parsed body
    // h3's readBody returns plain objects for multipart/form-data (not FormData instances),
    // so we handle both plain objects and string bodies uniformly.
    if (parsedBody && typeof parsedBody === 'object') {
      const jsonVal = (parsedBody as Record<string, unknown>)[
        config.token.fieldName
      ];
      if (typeof jsonVal === 'string') return jsonVal;
    } else if (typeof parsedBody === 'string') {
      try {
        const params = new URLSearchParams(parsedBody);
        const tokenValue = params.get(config.token.fieldName);
        if (tokenValue) return tokenValue;
      } catch (error) {
        console.warn(
          'Failed to parse string body as URL-encoded form data',
          error
        );
      }
    }

    return undefined;
  }

  /** Converts CookieOptions to h3-compatible cookie options. */
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
