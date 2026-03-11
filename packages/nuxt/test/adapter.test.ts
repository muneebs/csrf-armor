import { Readable } from 'node:stream';
import type {
  CookieOptions,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { H3Event } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NuxtAdapter } from '../src/runtime/server/adapter';

interface MockServerResponse {
  setHeader: ReturnType<typeof vi.fn>;
  getHeader: ReturnType<typeof vi.fn>;
  _headers: Record<string, string | string[]>;
}

interface MockH3Event {
  method: string;
  path: string;
  headers: Headers;
  node: {
    req: Readable;
    res: MockServerResponse;
  };
  context: Record<string, unknown>;
}

/** Creates a mock Node.js readable stream that emits the given body then ends. */
function createMockStream(body?: string | null): Readable {
  const stream = new Readable({ read() {} });
  if (body) stream.push(body);
  stream.push(null);
  return stream;
}

/** Creates a mock ServerResponse that tracks setHeader calls. */
function createMockRes(): MockServerResponse {
  const headers: Record<string, string | string[]> = {};
  return {
    setHeader: vi
      .fn()
      .mockImplementation((name: string, value: string | string[]) => {
        headers[name.toLowerCase()] = value;
      }),
    getHeader: vi
      .fn()
      .mockImplementation((name: string) => headers[name.toLowerCase()]),
    _headers: headers,
  };
}

/** Creates a minimal H3Event mock with proper native properties. */
function createMockEvent(
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: string | Record<string, unknown> | null;
  } = {}
): MockH3Event {
  const headerInit: Record<string, string> = { ...options.headers };

  if (options.cookies && Object.keys(options.cookies).length > 0) {
    headerInit['cookie'] = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  const bodyStr =
    options.body === null || options.body === undefined
      ? null
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);

  return {
    method: options.method ?? 'GET',
    path: options.path ?? '/',
    headers: new Headers(headerInit),
    node: {
      req: createMockStream(bodyStr),
      res: createMockRes(),
    },
    context: {},
  };
}

/** Extracts Set-Cookie values set on a mock response. */
function getSetCookies(res: MockServerResponse): string[] {
  const raw = res._headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Extracts response headers (excluding set-cookie) set on a mock response. */
function getResponseHeaders(res: MockServerResponse): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(res._headers)) {
    if (k !== 'set-cookie') result[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return result;
}

describe('NuxtAdapter', () => {
  let adapter: NuxtAdapter;

  beforeEach(() => {
    adapter = new NuxtAdapter();
  });

  describe('extractRequest', () => {
    it('should extract request data correctly', () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        path: '/api',
        headers: {
          host: 'localhost',
          'content-type': 'application/json',
          'x-csrf-token': 'test-token',
        },
        cookies: {
          'csrf-token': 'test-token',
          'session-id': 'test-session',
        },
      });

      const result = adapter.extractRequest(mockEvent as unknown as H3Event);

      expect(result.method).toBe('POST');
      expect(result.url).toBe('http://localhost/api');

      const headersMap = result.headers as Map<string, string>;
      expect(headersMap.get('content-type')).toBe('application/json');
      expect(headersMap.get('x-csrf-token')).toBe('test-token');

      const cookiesMap = result.cookies as Map<string, string>;
      expect(cookiesMap.get('csrf-token')).toBe('test-token');
      expect(cookiesMap.get('session-id')).toBe('test-session');

      expect(result.body).toBe(mockEvent);
    });
  });

  describe('applyResponse', () => {
    it('should apply headers and cookies from Map correctly', () => {
      const mockEvent = createMockEvent();

      const csrfResponse: CsrfResponse = {
        headers: new Map([
          ['x-csrf-token', 'new-token'],
          ['content-type', 'application/json'],
        ]),
        cookies: new Map([
          ['csrf-token', { value: 'new-token', options: { httpOnly: true } }],
          [
            'csrf-token-server',
            { value: 'signed-token', options: { httpOnly: true, path: '/' } },
          ],
        ]),
      };

      const result = adapter.applyResponse(
        mockEvent as unknown as H3Event,
        csrfResponse
      );

      const headers = getResponseHeaders(mockEvent.node.res);
      expect(headers['x-csrf-token']).toBe('new-token');
      expect(headers['content-type']).toBe('application/json');

      const cookies = getSetCookies(mockEvent.node.res);
      expect(
        cookies.some(
          (c) => c.startsWith('csrf-token=') && c.includes('HttpOnly')
        )
      ).toBe(true);
      expect(
        cookies.some(
          (c) =>
            c.startsWith('csrf-token-server=') &&
            c.includes('HttpOnly') &&
            c.includes('Path=/')
        )
      ).toBe(true);

      expect(result).toBe(mockEvent);
    });

    it('should apply headers and cookies from objects correctly', () => {
      const mockEvent = createMockEvent();

      const csrfResponse: CsrfResponse = {
        headers: {
          'x-csrf-token': 'new-token',
          'content-type': 'application/json',
        },
        cookies: {
          'csrf-token': { value: 'new-token', options: { httpOnly: true } },
          'csrf-token-server': {
            value: 'signed-token',
            options: { httpOnly: true, path: '/' },
          },
        },
      };

      const result = adapter.applyResponse(
        mockEvent as unknown as H3Event,
        csrfResponse
      );

      const headers = getResponseHeaders(mockEvent.node.res);
      expect(headers['x-csrf-token']).toBe('new-token');

      const cookies = getSetCookies(mockEvent.node.res);
      expect(
        cookies.some(
          (c) => c.startsWith('csrf-token=') && c.includes('HttpOnly')
        )
      ).toBe(true);

      expect(result).toBe(mockEvent);
    });
  });

  describe('getTokenFromRequest', () => {
    const baseConfig = {
      token: {
        headerName: 'x-csrf-token',
        fieldName: 'csrf',
      },
      cookie: {
        name: 'csrf-token',
      },
    } as RequiredCsrfConfig;

    it('should extract token from header', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'x-csrf-token': 'header-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', 'header-token']]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('header-token');
    });

    it('should extract token from cookie with lowercased name lookup', async () => {
      const configWithCasing = {
        ...baseConfig,
        cookie: { name: 'CSRF-Token' },
      } as RequiredCsrfConfig;

      const mockEvent = createMockEvent({
        method: 'POST',
        cookies: { 'csrf-token': 'cookie-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(
        request,
        configWithCasing
      );
      expect(token).toBe('cookie-token');
    });

    it('should fallback to original casing if lowercased cookie not found', async () => {
      const configWithCasing = {
        ...baseConfig,
        cookie: { name: 'CSRF-Token' },
      } as RequiredCsrfConfig;

      const mockEvent = createMockEvent({
        method: 'POST',
        cookies: { 'CSRF-Token': 'cookie-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['CSRF-Token', 'cookie-token']]),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(
        request,
        configWithCasing
      );
      expect(token).toBe('cookie-token');
    });

    it('should extract token from cookie', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        cookies: { 'csrf-token': 'cookie-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('cookie-token');
    });

    it('should extract token from JSON body', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { csrf: 'body-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('body-token');
    });

    it('should extract token from URL-encoded body', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'csrf=form-token&other=value',
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([
          ['content-type', 'application/x-www-form-urlencoded'],
        ]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('form-token');
    });

    it('should extract token from multipart/form-data body (as raw string)', async () => {
      // After removing h3's readBody, multipart comes in as raw string;
      // the token is extracted via URLSearchParams fallback on the raw body.
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data' },
        body: 'csrf=formdata-token&other=value',
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'multipart/form-data']]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('formdata-token');
    });

    it('should extract token from URL-encoded string body (text/plain)', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'csrf=urlencoded-token&other=value',
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'text/plain']]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBe('urlencoded-token');
    });

    it('should return undefined when no token is found', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {},
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBeUndefined();
    });

    it('should handle readBody failure gracefully', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      // Simulate a stream error
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEvent.node.req.destroy(new Error('Stream error'));

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      };

      const token = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should use cached body on second call for same event', async () => {
      const mockEvent = createMockEvent({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { csrf: 'cached-token' },
      });

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      };

      // First call reads and caches
      const token1 = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token1).toBe('cached-token');

      // Mutate the stream so a second read would fail — proves cache is used
      mockEvent.node.req.destroy();

      // Second call uses the adapter's WeakMap cache
      const token2 = await adapter.getTokenFromRequest(request, baseConfig);
      expect(token2).toBe('cached-token');
    });
  });

  describe('cookie options adaptation', () => {
    it('should serialize cookie options correctly through applyResponse', () => {
      const mockEvent = createMockEvent();

      const cookieOptions: CookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'strict' as const,
        path: '/api',
        domain: 'example.com',
        maxAge: 3600,
      };

      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([
          ['test-cookie', { value: 'test-value', options: cookieOptions }],
        ]),
      };

      adapter.applyResponse(mockEvent as unknown as H3Event, csrfResponse);

      const cookies = getSetCookies(mockEvent.node.res);
      expect(cookies).toHaveLength(1);
      const cookieStr = cookies[0]!;
      expect(cookieStr).toContain('test-cookie=test-value');
      expect(cookieStr).toContain('Max-Age=3600');
      expect(cookieStr).toContain('Path=/api');
      expect(cookieStr).toContain('Domain=example.com');
      expect(cookieStr).toContain('Secure');
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('SameSite=strict');
    });

    it('should handle undefined cookie options', () => {
      const mockEvent = createMockEvent();

      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([['test-cookie', { value: 'test-value' }]]),
      };

      adapter.applyResponse(mockEvent as unknown as H3Event, csrfResponse);

      const cookies = getSetCookies(mockEvent.node.res);
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain('test-cookie=test-value');
    });
  });

  describe('concurrent requests', () => {
    it('should handle cookies and headers correctly for concurrent requests', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        createMockEvent({
          headers: { 'x-request-id': `req-${i}` },
        })
      );

      const csrfResponses: CsrfResponse[] = events.map((_, i) => ({
        headers: new Map([
          ['x-csrf-token', `token-${i}`],
          ['x-request-id', `req-${i}`],
        ]),
        cookies: new Map([
          ['csrf-token', { value: `csrf-${i}`, options: { httpOnly: true } }],
          [
            'session-id',
            { value: `session-${i}`, options: { secure: true, path: '/' } },
          ],
        ]),
      }));

      const results = await Promise.all(
        events.map((event, i) =>
          Promise.resolve(
            adapter.applyResponse(
              event as unknown as H3Event,
              csrfResponses[i]!
            )
          )
        )
      );

      results.forEach((result, i) => {
        expect(result).toBe(events[i]);
      });

      events.forEach((event, i) => {
        const headers = getResponseHeaders(event.node.res);
        expect(headers['x-csrf-token']).toBe(`token-${i}`);

        const cookies = getSetCookies(event.node.res);
        expect(
          cookies.some(
            (c) =>
              c.startsWith(`csrf-token=csrf-${i}`) && c.includes('HttpOnly')
          )
        ).toBe(true);
      });
    });

    it('should maintain request isolation during concurrent token extraction from different sources', async () => {
      const config = {
        token: { headerName: 'x-csrf-token', fieldName: 'csrf' },
        cookie: { name: 'csrf-token' },
      } as RequiredCsrfConfig;

      const headerEvent = createMockEvent({
        headers: { 'x-csrf-token': 'header-token' },
      });
      const bodyEvent = createMockEvent({
        headers: { 'content-type': 'application/json' },
        body: { csrf: 'body-token' },
      });
      const cookieEvent = createMockEvent({
        cookies: { 'csrf-token': 'cookie-token' },
      });

      const [headerToken, bodyToken, cookieToken] = await Promise.all([
        adapter.getTokenFromRequest(
          {
            method: 'POST',
            url: 'http://localhost/api/1',
            headers: new Map([['x-csrf-token', 'header-token']]),
            cookies: new Map(),
            body: headerEvent,
          },
          config
        ),
        adapter.getTokenFromRequest(
          {
            method: 'POST',
            url: 'http://localhost/api/2',
            headers: new Map([['content-type', 'application/json']]),
            cookies: new Map(),
            body: bodyEvent,
          },
          config
        ),
        adapter.getTokenFromRequest(
          {
            method: 'POST',
            url: 'http://localhost/api/3',
            headers: new Map(),
            cookies: new Map([['csrf-token', 'cookie-token']]),
            body: cookieEvent,
          },
          config
        ),
      ]);

      expect(headerToken).toBe('header-token');
      expect(bodyToken).toBe('body-token');
      expect(cookieToken).toBe('cookie-token');
    });
  });
});
