import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { H3Event } from 'h3';

/**
 * Strips only spaces and tabs (RFC 6265 whitespace) from both ends.
 *
 * `String.prototype.trim()` must not be used for cookie names: it also strips
 * Unicode whitespace such as U+00A0 and U+2000. Browsers treat a cookie named
 * `__Host-x` with a leading U+00A0 as an ordinary, unprefixed cookie that a
 * sibling subdomain can set, so trimming it here would let it pass as `__Host-x`.
 */
function trimCookieWhitespace(input: string): string {
  let start = 0;
  let end = input.length;
  while (start < end && (input[start] === ' ' || input[start] === '\t')) {
    start++;
  }
  while (end > start && (input[end - 1] === ' ' || input[end - 1] === '\t')) {
    end--;
  }
  return input.slice(start, end);
}

/** Parses a raw Cookie header string into a name→value map. */
function parseCookieHeader(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimCookieWhitespace(pair.slice(0, eqIndex));
    const value = trimCookieWhitespace(pair.slice(eqIndex + 1));
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

/**
 * Default cap on the bytes read from a request body while looking for a CSRF
 * token. Matches the Express body-parser default.
 */
export const DEFAULT_MAX_BODY_SIZE = 100 * 1024;

/** Error raised when a body exceeds the token-extraction size limit. */
class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Where h3's `readRawBody` caches a request body (`Symbol.for` makes it the
 * same symbol h3 uses). A Node stream can only be read once, so the body read
 * here must be left for h3, or the route's `readBody(event)` waits forever.
 */
const H3_RAW_BODY = Symbol.for('h3RawBody');

/**
 * Reads the raw request body, stopping as soon as it exceeds `maxBytes` so an
 * oversized body is never buffered in full.
 */
function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(req.headers?.['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return Promise.reject(new BodyTooLargeError(maxBytes));
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    // The error listener stays attached: removing it would turn a later
    // stream error (for example a client abort) into an uncaught exception.
    // Rejecting an already-settled promise is a no-op.
    const stopReading = () => {
      req.off('data', onData);
      req.off('end', onEnd);
    };
    const onData = (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        stopReading();
        req.pause();
        chunks.length = 0;
        reject(new BodyTooLargeError(maxBytes));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      stopReading();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: Error) => {
      stopReading();
      reject(error);
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

/** Reads and parses the request body based on its content type. Returns null for unsupported types. */
async function parseBody(
  event: H3Event,
  contentType: string,
  maxBytes: number
): Promise<unknown> {
  const supportedTypes = [
    'application/json',
    'application/ld+json',
    'application/x-www-form-urlencoded',
    'text/plain',
  ];

  if (!supportedTypes.some((t) => contentType.startsWith(t))) return null;

  const req = event.node?.req as IncomingMessage | undefined;
  if (!req) return null;

  const pending = readRawBody(req, maxBytes);
  // Hand the body to h3 so the route can still read it after this middleware.
  (req as IncomingMessage & { [H3_RAW_BODY]?: Promise<Buffer> })[H3_RAW_BODY] =
    pending;
  // The rejection is handled below; this copy must not surface as unhandled.
  pending.catch(() => {});

  const rawBody = (await pending).toString('utf-8');

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

  /** Maximum body bytes read while looking for a body-submitted token. */
  private readonly maxBodySize: number;

  /**
   * @param options.maxBodySize - Maximum body bytes read while looking for a
   *   body-submitted token (default {@link DEFAULT_MAX_BODY_SIZE}). Larger
   *   bodies are not read and yield no token, so the request fails validation.
   */
  constructor(options: { maxBodySize?: number } = {}) {
    this.maxBodySize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
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

    // 3. Try body
    let parsedBody: unknown;
    if (this.parsedBodyCache.has(event)) {
      parsedBody = this.parsedBodyCache.get(event);
    } else {
      const contentType = event.headers.get('content-type') ?? 'text/plain';
      try {
        parsedBody = await parseBody(event, contentType, this.maxBodySize);
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
