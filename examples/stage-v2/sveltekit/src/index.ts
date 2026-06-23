import type {
  CsrfAdapter,
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  RequiredCookieOptions,
} from '@csrf-armor/core';
import { createCsrfProtection, CSRF_TOKEN_HEADER } from '@csrf-armor/core';
import type { Cookies, Request as SvelteKitRequest, RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

/** @internal */
function createSvelteKitRequest(event: RequestEvent, body: unknown): CsrfRequest {
  const headers = new Map<string, string>();
  event.request.headers.forEach((value, key) => headers.set(key.toLowerCase(), value));

  const cookies = new Map<string, string>();
  const cookieHeader = event.request.headers.get('cookie') ?? '';
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.split('=');
      if (!name) continue;
      cookies.set(decodeURIComponent(name.trim()), decodeURIComponent(rest.join('=').trim()));
    }
  }

  return {
    url: event.request.url,
    method: event.request.method,
    headers,
    cookies,
    body,
  };
}

/**
 * SvelteKit CSRF adapter.
 *
 * @public
 */
export class SvelteKitAdapter implements CsrfAdapter<RequestEvent, RequestEvent> {
  /** Cache of parsed bodies keyed by request. */
  private readonly parsedBodyCache = new WeakMap<RequestEvent, unknown>();

  constructor() {
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  extractRequest(request: RequestEvent): CsrfRequest {
    const cached = this.parsedBodyCache.get(request);
    return createSvelteKitRequest(request, cached ?? null);
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

  applyResponse(response: RequestEvent, csrfResponse: CsrfResponse): RequestEvent {
    for (const [name, { value, options }] of csrfResponse.cookies.entries()) {
      const opts = options as RequiredCookieOptions | undefined;
      response.cookies.set(name, value, {
        path: opts?.path ?? '/',
        secure: opts?.secure,
        httpOnly: opts?.httpOnly,
        sameSite: opts?.sameSite,
        domain: opts?.domain,
        maxAge: opts?.maxAge,
      });
    }

    for (const [name, value] of csrfResponse.headers.entries()) {
      if (name === CSRF_TOKEN_HEADER) {
        // In SvelteKit the client reads the token from a cookie, so the header
        // is exposed as a `csrf-token` header on the initial page load response.
        continue;
      }
      response.setHeaders?.(name, value);
    }

    return response;
  }

  /**
   * Parses the request body for token extraction.
   *
   * SvelteKit `event.request` is already a standard `Request`, so we just read
   * and parse it once per request. The clone is consumed, which is safe
   * because SvelteKit later calls `event.request.json()` on a fresh request.
   */
  async parseBody(event: RequestEvent, maxBodySize = 1024 * 1024): Promise<unknown> {
    if (this.parsedBodyCache.has(event)) {
      return this.parsedBodyCache.get(event);
    }

    const contentType = event.request.headers.get('content-type') ?? 'text/plain';
    const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
    const supported = ['application/json', 'application/x-www-form-urlencoded', 'text/plain'];
    if (!supported.includes(normalized)) {
      this.parsedBodyCache.set(event, null);
      return null;
    }

    try {
      const cloned = event.request.clone();
      const buffer = await cloned.arrayBuffer();
      if (buffer.byteLength > maxBodySize) {
        throw new Error('Request body exceeds maximum CSRF parsing size');
      }
      const text = new TextDecoder().decode(buffer);
      const parsed = normalized === 'application/json' ? JSON.parse(text) : text;
      this.parsedBodyCache.set(event, parsed);
      return parsed;
    } catch (error) {
      console.warn('[csrf-armor/sveltekit] Failed to parse body:', error);
      this.parsedBodyCache.set(event, null);
      return null;
    }
  }
}

export interface SvelteKitCsrfOptions extends CsrfConfig {
  /** Maximum body size in bytes read for token extraction (default: 1MB) */
  maxBodySize?: number;
  /** SvelteKit `handle` sequence options */
  filter?: (event: RequestEvent) => boolean;
}

/**
 * SvelteKit server `handle` hook factory.
 *
 * @public
 */
export function csrfHandle(options?: SvelteKitCsrfOptions): (event: RequestEvent) => Promise<Response | undefined> {
  const adapter = new SvelteKitAdapter();
  const protection = createCsrfProtection(adapter, options);
  const maxBodySize = options?.maxBodySize ?? 1024 * 1024;

  return async function csrfHandleImpl(event: RequestEvent): Promise<Response | undefined> {
    if (options?.filter && !options.filter(event)) {
      return undefined;
    }

    await adapter.parseBody(event, maxBodySize);
    const result = await protection.protect(event, event);

    if (!result.success) {
      // SvelteKit convention: throw a 403 Response for rejected state-changing requests.
      throw new Response(JSON.stringify({ error: 'Forbidden', reason: result.reason }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return undefined;
  };
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
