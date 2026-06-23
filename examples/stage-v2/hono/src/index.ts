import type {
  CsrfAdapter,
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  RequiredCookieOptions,
} from '@csrf-armor/core';
import { createCsrfProtection } from '@csrf-armor/core';
import type { Context, Hono, MiddlewareHandler, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

/** @internal */
function extractHeaders(c: Context): Map<string, string> {
  const map = new Map<string, string>();
  c.req.raw.headers.forEach((value, key) => {
    map.set(key.toLowerCase(), value);
  });
  return map;
}

/** @internal */
function parseCookies(c: Context): Map<string, string> {
  const map = new Map<string, string>();
  const cookieHeader = c.req.header('cookie') ?? '';
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.split('=');
    if (!name) continue;
    map.set(decodeURIComponent(name.trim()), decodeURIComponent(rest.join('=').trim()));
  }
  return map;
}

/** @internal */
function createHonoRequest(c: Context, body: unknown): CsrfRequest {
  return {
    url: c.req.url,
    method: c.req.method,
    headers: extractHeaders(c),
    cookies: parseCookies(c),
    body,
  };
}

/**
 * Hono CSRF adapter.
 *
 * @public
 */
export class HonoAdapter implements CsrfAdapter<Context, Context> {
  /** Cache of parsed bodies keyed by Hono context (request identity). */
  private readonly parsedBodyCache = new WeakMap<Context, unknown>();

  constructor() {
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  extractRequest(request: Context): CsrfRequest {
    const cached = this.parsedBodyCache.get(request);
    return createHonoRequest(request, cached ?? null);
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: { token: { headerName: string; fieldName: string }; cookie: { name: string } }
  ): Promise<string | undefined> {
    const headers =
      request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers ?? {}));

    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    const cookies =
      request.cookies instanceof Map
        ? request.cookies
        : new Map(Object.entries(request.cookies ?? {}));
    const cookieValue = cookies.get(config.cookie.name);
    if (cookieValue) return cookieValue;

    if (request.body && typeof request.body === 'object') {
      const body = request.body as Record<string, unknown>;
      const value = body[config.token.fieldName];
      if (typeof value === 'string') return value;
    }

    return undefined;
  }

  applyResponse(response: Context, csrfResponse: CsrfResponse): Context {
    for (const [name, { value, options }] of csrfResponse.cookies.entries()) {
      const opts = options as RequiredCookieOptions | undefined;
      setCookie(response, name, value, {
        path: opts?.path ?? '/',
        secure: opts?.secure,
        httpOnly: opts?.httpOnly,
        sameSite: opts?.sameSite,
        domain: opts?.domain,
        maxAge: opts?.maxAge,
      });
    }

    for (const [name, value] of csrfResponse.headers.entries()) {
      response.header(name, value);
    }

    return response;
  }

  /**
   * Parses the request body for token extraction.
   *
   * Honors `maxBodySize` from the Hono middleware options.
   */
  async parseBody(c: Context, maxBodySize = 1024 * 1024): Promise<unknown> {
    if (this.parsedBodyCache.has(c)) {
      return this.parsedBodyCache.get(c);
    }

    const contentType = c.req.header('content-type') ?? 'text/plain';
    const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    const supported = ['application/json', 'application/x-www-form-urlencoded', 'text/plain'];
    if (!supported.includes(normalized)) {
      this.parsedBodyCache.set(c, null);
      return null;
    }

    try {
      const cloned = c.req.raw.clone();
      const buffer = await cloned.arrayBuffer();
      if (buffer.byteLength > maxBodySize) {
        throw new Error('Request body exceeds maximum CSRF parsing size');
      }
      const text = new TextDecoder().decode(buffer);
      const parsed = normalized === 'application/json' ? JSON.parse(text) : text;
      this.parsedBodyCache.set(c, parsed);
      return parsed;
    } catch (error) {
      console.warn('[csrf-armor/hono] Failed to parse body:', error);
      this.parsedBodyCache.set(c, null);
      return null;
    }
  }
}

export interface HonoCsrfOptions extends CsrfConfig {
  /** Maximum body size in bytes read for token extraction (default: 1MB) */
  maxBodySize?: number;
}

/**
 * Creates a Hono middleware that protects against CSRF attacks.
 *
 * @public
 */
export function csrfMiddleware(options?: HonoCsrfOptions): MiddlewareHandler {
  const adapter = new HonoAdapter();
  const protection = createCsrfProtection(adapter, options);
  const maxBodySize = options?.maxBodySize ?? 1024 * 1024;

  return async function csrfMiddlewareHandler(c: Context, next: Next): Promise<Response | void> {
    await adapter.parseBody(c, maxBodySize);
    const result = await protection.protect(c, c);

    if (!result.success) {
      return c.json({ error: 'Forbidden', reason: result.reason }, 403);
    }

    await next();
  };
}

/**
 * Convenience helper to add the middleware to a Hono app.
 *
 * @public
 */
export function addCsrfProtection(app: Hono, options?: HonoCsrfOptions): Hono {
  app.use(csrfMiddleware(options));
  return app;
}

// Re-export core types for consumer convenience
export type {
  ContentTypeOptions,
  CookieOptions,
  CsrfConfig,
  CsrfLogger,
  CsrfMetrics,
  CsrfProtectResult,
  CsrfStrategy,
  GetSessionId,
  OnFailureContext,
  TokenOptions,
  ValidationResult,
} from '@csrf-armor/core';
export {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
} from '@csrf-armor/core';
