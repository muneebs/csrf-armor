import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { H3Event } from 'h3';

/** Parses a raw Cookie header string into a name→value map. */
function parseCookieHeader(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

/** Serializes a cookie name/value and options into a Set-Cookie header string. */
function serializeCookie(
  name: string,
  value: string,
  options?: CookieOptions
): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options?.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options?.path) cookie += `; Path=${options.path}`;
  if (options?.domain) cookie += `; Domain=${options.domain}`;
  if (options?.secure) cookie += '; Secure';
  if (options?.httpOnly) cookie += '; HttpOnly';
  if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`;
  return cookie;
}

/** Appends a Set-Cookie value to the response without overwriting existing ones. */
function appendSetCookie(res: ServerResponse, cookieStr: string): void {
  const existing = res.getHeader('set-cookie');
  if (existing) {
    const arr = Array.isArray(existing) ? existing : [String(existing)];
    res.setHeader('set-cookie', [...arr, cookieStr]);
  } else {
    res.setHeader('set-cookie', cookieStr);
  }
}

/** Reads and parses the request body based on its content type. Returns null for unsupported types. */
async function parseBody(
  event: H3Event,
  contentType: string
): Promise<unknown> {
  const supportedTypes = [
    'application/json',
    'application/ld+json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ];

  if (!supportedTypes.some((t) => contentType.startsWith(t))) return null;

  const req = event.node?.req as IncomingMessage | undefined;
  if (!req) return null;

  const rawBody = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });

  if (!rawBody) return null;

  if (
    contentType.startsWith('application/json') ||
    contentType.startsWith('application/ld+json')
  ) {
    return JSON.parse(rawBody);
  }

  return rawBody;
}

/**
 * Nuxt adapter for the CSRF protection system.
 *
 * Bridges H3 event objects with the framework-agnostic CSRF protection logic
 * from `@csrf-armor/core` using only the H3Event's native properties
 * (`event.method`, `event.headers`, `event.path`, `event.node`).
 */
export class NuxtAdapter implements CsrfAdapter<H3Event, H3Event> {
  /** Cache parsed bodies to avoid double reads on the same event. */
  private readonly parsedBodyCache = new WeakMap<H3Event, unknown>();

  constructor() {
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  extractRequest(event: H3Event): CsrfRequest {
    const rawCookies = parseCookieHeader(event.headers.get('cookie'));
    const cookies = new Map<string, string>(Object.entries(rawCookies));

    // Reconstruct the full URL from the H3Event's native properties
    const host =
      event.headers.get('x-forwarded-host') ??
      event.headers.get('host') ??
      'localhost';
    const proto =
      (event.headers.get('x-forwarded-proto') ?? 'http')
        .split(',')[0]
        ?.trim() ?? 'http';
    const path = event.path.startsWith('/') ? event.path : `/${event.path}`;

    return {
      method: event.method,
      url: new URL(path, `${proto}://${host}`).href,
      headers: event.headers, // Web Headers API — accepted directly by core
      cookies,
      body: event,
    };
  }

  applyResponse(event: H3Event, csrfResponse: CsrfResponse): H3Event {
    const res = event.node.res;

    if (csrfResponse.headers instanceof Map) {
      for (const [key, value] of csrfResponse.headers) {
        res.setHeader(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(csrfResponse.headers)) {
        res.setHeader(key, String(value));
      }
    }

    if (csrfResponse.cookies instanceof Map) {
      for (const [name, cookieData] of csrfResponse.cookies) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        appendSetCookie(res, serializeCookie(name, value, options));
      }
    } else {
      for (const [name, cookieData] of Object.entries(csrfResponse.cookies)) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        appendSetCookie(res, serializeCookie(name, value, options));
      }
    }

    return event;
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const event = request.body as H3Event;

    // 1. Try header first (H3 normalizes header names to lowercase)
    const headerValue = event.headers.get(
      config.token.headerName.toLowerCase()
    );
    if (headerValue) return headerValue;

    // 2. Try cookie — use the already-parsed Map from extractRequest
    const cookies = request.cookies as Map<string, string>;
    const cookieValue =
      cookies.get(config.cookie.name.toLowerCase()) ??
      cookies.get(config.cookie.name);
    if (cookieValue) return cookieValue;

    // 3. Try body
    let parsedBody: unknown;
    if (this.parsedBodyCache.has(event)) {
      parsedBody = this.parsedBodyCache.get(event);
    } else {
      const contentType = event.headers.get('content-type') ?? 'text/plain';
      try {
        parsedBody = await parseBody(event, contentType);
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

    if (parsedBody && typeof parsedBody === 'object') {
      const val = (parsedBody as Record<string, unknown>)[
        config.token.fieldName
      ];
      if (typeof val === 'string') return val;
    } else if (typeof parsedBody === 'string') {
      try {
        const tokenValue = new URLSearchParams(parsedBody).get(
          config.token.fieldName
        );
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
}
