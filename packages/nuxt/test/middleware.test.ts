import { Readable } from 'node:stream';
import { createCsrfProtection, verifySignedToken } from '@csrf-armor/core';
import type { H3Event } from 'h3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NuxtAdapter } from '../src/runtime/server/adapter';

interface MockServerResponse {
  setHeader: ReturnType<typeof vi.fn>;
  getHeader: ReturnType<typeof vi.fn>;
  _headers: Record<string, string | string[]>;
}

/** Creates a mock Node.js readable stream that emits body then ends. */
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

function createGetEvent(
  url = 'http://localhost/',
  requestHeaders: Record<string, string> = {}
): H3Event {
  const parsedUrl = new URL(url);
  const headers = new Headers({
    host: parsedUrl.host,
    ...requestHeaders,
  });
  return {
    method: 'GET',
    path: parsedUrl.pathname + parsedUrl.search,
    headers,
    node: { req: createMockStream(null), res: createMockRes() },
    context: {},
  } as unknown as H3Event;
}

function createPostEvent(
  url: string,
  requestHeaders: Record<string, string>,
  cookies: Record<string, string>,
  body?: string | Record<string, unknown>
): H3Event {
  const parsedUrl = new URL(url);
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const headers = new Headers({
    host: parsedUrl.host,
    ...requestHeaders,
    ...(cookieStr ? { cookie: cookieStr } : {}),
  });

  const bodyStr =
    body === undefined
      ? null
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);

  return {
    method: 'POST',
    path: parsedUrl.pathname + parsedUrl.search,
    headers,
    node: { req: createMockStream(bodyStr), res: createMockRes() },
    context: {},
  } as unknown as H3Event;
}

/** Collects cookies set on the response. Returns name→value map. */
function getSetCookies(event: H3Event): Record<string, string> {
  const res = (event.node.res as unknown as MockServerResponse)._headers[
    'set-cookie'
  ];
  const cookieHeaders = Array.isArray(res) ? res : res ? [String(res)] : [];
  const result: Record<string, string> = {};
  for (const cookieStr of cookieHeaders) {
    const [nameValue] = cookieStr.split(';');
    if (!nameValue) continue;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) continue;
    const name = nameValue.slice(0, eqIdx).trim();
    result[name] = decodeURIComponent(nameValue.slice(eqIdx + 1).trim());
  }
  return result;
}

/** Collects non-cookie response headers. */
function getResponseHeaders(event: H3Event): Record<string, string> {
  const all = (event.node.res as unknown as MockServerResponse)._headers;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k !== 'set-cookie')
      result[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return result;
}

describe('Nuxt CSRF Middleware Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow GET requests without validation', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter);
    const event = createGetEvent();

    const result = await protection.protect(event, event);

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should set CSRF token header and cookie on GET', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter);
    const event = createGetEvent();

    await protection.protect(event, event);

    const headers = getResponseHeaders(event);
    const cookies = getSetCookies(event);

    expect(headers['x-csrf-token']).toBeDefined();
    expect(cookies['csrf-token']).toBeDefined();
  });

  it('should exclude configured paths from protection', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      excludePaths: ['/api/webhook'],
    });

    const event = createPostEvent('http://localhost/api/webhook', {}, {});
    const result = await protection.protect(event, event);

    expect(result.success).toBe(true);
  });

  it('should use custom cookie name', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      cookie: { name: 'my-csrf' },
    });

    const event = createGetEvent();
    await protection.protect(event, event);

    const cookies = getSetCookies(event);
    expect(cookies['my-csrf']).toBeDefined();
  });

  it('should generate unsigned tokens for double-submit strategy', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
    });

    const event = createGetEvent();
    await protection.protect(event, event);

    const headers = getResponseHeaders(event);
    const cookies = getSetCookies(event);

    expect(headers['x-csrf-token']).toBeDefined();
    expect(cookies['csrf-token']).toBeDefined();
    expect(headers['x-csrf-token']).toBe(cookies['csrf-token']);

    // Unsigned tokens have no dots
    expect(headers['x-csrf-token']?.includes('.')).toBe(false);
  });

  it('should generate signed tokens for signed-double-submit strategy', async () => {
    const secret = 'test-secret-32-characters-long-123'; // gitleaks:allow
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      strategy: 'signed-double-submit',
      secret,
    });

    const event = createGetEvent();
    await protection.protect(event, event);

    const headers = getResponseHeaders(event);
    const cookies = getSetCookies(event);

    const headerToken = headers['x-csrf-token'];
    const clientCookie = cookies['csrf-token'];
    const serverCookie = cookies['csrf-token-server'];

    expect(headerToken).toBeDefined();
    expect(clientCookie).toBeDefined();
    expect(serverCookie).toBeDefined();

    // Header and client cookie are unsigned and identical
    expect(headerToken).toBe(clientCookie);
    expect(headerToken?.includes('.')).toBe(false);

    // Server cookie is signed (contains a dot)
    expect(serverCookie?.split('.').length).toBe(2);

    // Signed server cookie contains the unsigned token
    // biome-ignore lint/style/noNonNullAssertion: serverCookie is already assigned
    const verified = await verifySignedToken(serverCookie!, secret);
    expect(verified).toBe(headerToken);
  });

  it('should validate origin-check POST with correct origin', async () => {
    const adapter = new NuxtAdapter();

    vi.spyOn(adapter, 'extractRequest').mockImplementation(() => ({
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://localhost']]),
      cookies: new Map(),
      body: undefined,
    }));

    const protection = createCsrfProtection(adapter, {
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost'],
    });

    const event = createPostEvent('http://localhost/api', {}, {});
    const result = await protection.protect(event, event);

    expect(result.success).toBe(true);
  });

  it('should reject origin-check POST with wrong origin', async () => {
    const adapter = new NuxtAdapter();

    vi.spyOn(adapter, 'extractRequest').mockImplementation(() => ({
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://evil.com']]),
      cookies: new Map(),
      body: undefined,
    }));

    const protection = createCsrfProtection(adapter, {
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost'],
    });

    const event = createPostEvent('http://localhost/api', {}, {});
    const result = await protection.protect(event, event);

    expect(result.success).toBe(false);
  });

  it('should accept POST with matching token for double-submit', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
    });

    // Issue a token via GET
    const getEvent = createGetEvent();
    await protection.protect(getEvent, getEvent);
    const issuedToken = getResponseHeaders(getEvent)['x-csrf-token'];

    expect(issuedToken).toBeDefined();

    // Submit it back in header + cookie
    const postEvent = createPostEvent(
      'http://localhost/api',
      { 'x-csrf-token': issuedToken },
      { 'csrf-token': issuedToken }
    );
    const result = await protection.protect(postEvent, postEvent);

    expect(result.success).toBe(true);
  });

  it('should accept POST with token in JSON body for double-submit', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
      token: { fieldName: '_csrf' },
    });

    // Issue a token via GET
    const getEvent = createGetEvent();
    await protection.protect(getEvent, getEvent);
    const issuedToken = getResponseHeaders(getEvent)['x-csrf-token'];

    expect(issuedToken).toBeDefined();

    // Submit token in body + cookie (no header)
    const postEvent = createPostEvent(
      'http://localhost/api',
      { 'content-type': 'application/json' },
      { 'csrf-token': issuedToken },
      { _csrf: issuedToken }
    );
    const result = await protection.protect(postEvent, postEvent);

    expect(result.success).toBe(true);
  });

  it('should reject POST without token for double-submit', async () => {
    const adapter = new NuxtAdapter();
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
    });

    const event = createPostEvent(
      'http://localhost/api',
      { 'content-type': 'application/json' },
      {}
    );

    const result = await protection.protect(event, event);

    expect(result.success).toBe(false);
  });
});
