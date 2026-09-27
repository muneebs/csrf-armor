import { describe, expect, it, beforeEach } from 'vitest';
import { CsrfProtection, createCsrfProtection } from '../src/csrf.js';
import type {
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '../src';

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

class MockAdapter implements CsrfAdapter<CsrfRequest, Record<string, unknown>> {
  extractRequest(req: CsrfRequest): CsrfRequest {
    return req;
  }

  applyResponse(
    res: Record<string, unknown>,
    csrfResponse: CsrfResponse
  ): Record<string, unknown> {
    return { ...res, csrfResponse };
  }

  async getTokenFromRequest(
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers =
      req.headers instanceof Map
        ? req.headers
        : new Map(Object.entries(req.headers));
    return headers.get(config.token.headerName.toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-for-csrf-tests-1234';

/** Builds a minimal GET request. */
function makeRequest(
  overrides: Partial<CsrfRequest> & { method: string; url?: string }
): CsrfRequest {
  return {
    url: 'http://localhost/api/data',
    headers: new Map(),
    cookies: new Map(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createCsrfProtection factory
// ---------------------------------------------------------------------------

describe('createCsrfProtection', () => {
  it('returns an instance of CsrfProtection', () => {
    const adapter = new MockAdapter();
    const instance = createCsrfProtection(adapter, {
      secret: TEST_SECRET,
      strategy: 'double-submit',
    });
    expect(instance).toBeInstanceOf(CsrfProtection);
  });
});

// ---------------------------------------------------------------------------
// Safe HTTP methods (GET / HEAD / OPTIONS)
// ---------------------------------------------------------------------------

describe('CsrfProtection – safe methods', () => {
  let csrf: CsrfProtection<CsrfRequest, Record<string, unknown>>;

  beforeEach(() => {
    csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
    });
  });

  it('GET request succeeds and returns a token', async () => {
    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    expect(typeof result.token).toBe('string');
    expect(result.token!.length).toBeGreaterThan(0);
  });

  it('HEAD request succeeds and returns a token', async () => {
    const req = makeRequest({ method: 'HEAD' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    expect(typeof result.token).toBe('string');
  });

  it('OPTIONS request succeeds and returns a token', async () => {
    const req = makeRequest({ method: 'OPTIONS' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    expect(typeof result.token).toBe('string');
  });

  it('safe-method response includes csrf headers and cookies via adapter', async () => {
    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    // The mock adapter merges csrfResponse into the returned response object
    const response = result.response as Record<string, unknown>;
    expect(response).toHaveProperty('csrfResponse');

    const csrfResponse = response.csrfResponse as CsrfResponse;
    const headers =
      csrfResponse.headers instanceof Map
        ? csrfResponse.headers
        : new Map(Object.entries(csrfResponse.headers));

    expect(headers.has('x-csrf-token')).toBe(true);
    expect(headers.has('x-csrf-strategy')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unsafe HTTP methods without a valid token
// ---------------------------------------------------------------------------

describe('CsrfProtection – unsafe methods without token', () => {
  let csrf: CsrfProtection<CsrfRequest, Record<string, unknown>>;

  beforeEach(() => {
    csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
    });
  });

  it('POST without token returns success=false', async () => {
    const req = makeRequest({ method: 'POST' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('PUT without token returns success=false', async () => {
    const req = makeRequest({ method: 'PUT' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
  });

  it('DELETE without token returns success=false', async () => {
    const req = makeRequest({ method: 'DELETE' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// excludePaths
// ---------------------------------------------------------------------------

describe('CsrfProtection – excludePaths', () => {
  it('POST to an excluded path returns success=true without requiring a token', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api/public'],
    });

    const originalResponse = { marker: 'original' };
    const req = makeRequest({
      method: 'POST',
      url: 'http://localhost/api/public',
    });
    const result = await csrf.protect(req, originalResponse);

    expect(result.success).toBe(true);
    // For excluded paths, protect() returns the original response unchanged
    expect(result.response).toBe(originalResponse);
  });

  it('POST to a non-excluded path still requires validation', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api/public'],
    });

    const req = makeRequest({
      method: 'POST',
      url: 'http://localhost/api/private',
    });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
  });

  it('prefix matching: /api/public matches /api/public/foo', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api/public'],
    });

    const originalResponse = { marker: 'original' };
    const req = makeRequest({
      method: 'POST',
      url: 'http://localhost/api/public/foo',
    });
    const result = await csrf.protect(req, originalResponse);

    expect(result.success).toBe(true);
    expect(result.response).toBe(originalResponse);
  });

  it('URL with query string: pathname is correctly extracted for excludePaths matching', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api/public'],
    });

    const originalResponse = { marker: 'original' };
    // Relative URL with query string — falls back to manual parsing in extractPathname
    const req = makeRequest({
      method: 'POST',
      url: '/api/public?foo=bar',
    });
    const result = await csrf.protect(req, originalResponse);

    expect(result.success).toBe(true);
    expect(result.response).toBe(originalResponse);
  });
});

// ---------------------------------------------------------------------------
// excludePaths – path-segment boundaries (SEC-VAL-2)
// ---------------------------------------------------------------------------

describe('CsrfProtection – excludePaths path-segment boundaries', () => {
  it('AC-1: /api excludes /api (exact) and /api/v1 (child) but not /api-public or /apiv2', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api'],
    });

    // exact match — skipped
    let result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api' }),
      {}
    );
    expect(result.success).toBe(true);

    // child — skipped
    result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api/v1' }),
      {}
    );
    expect(result.success).toBe(true);

    // unrelated prefix — NOT skipped
    result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api-public' }),
      {}
    );
    expect(result.success).toBe(false);

    // unrelated prefix — NOT skipped
    result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/apiv2' }),
      {}
    );
    expect(result.success).toBe(false);
  });

  it('AC-2: /api/ excludes /api/v1 (child) but not /api (bare)', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/api/'],
    });

    // child — skipped
    let result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api/v1' }),
      {}
    );
    expect(result.success).toBe(true);

    // bare path — NOT skipped (trailing slash = children only)
    result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api' }),
      {}
    );
    expect(result.success).toBe(false);
  });

  it('AC-3: exact pathname match still works', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: ['/health'],
    });

    const result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/health' }),
      {}
    );
    expect(result.success).toBe(true);
  });

  it('AC-4: empty excludePaths excludes nothing', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      excludePaths: [],
    });

    const result = await csrf.protect(
      makeRequest({ method: 'POST', url: 'http://localhost/api/public' }),
      {}
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// skipContentTypes
// ---------------------------------------------------------------------------

describe('CsrfProtection – skipContentTypes', () => {
  it('POST with a skipped content-type returns success=true without requiring a token', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      skipContentTypes: ['text/plain'],
    });

    const req = makeRequest({
      method: 'POST',
      headers: new Map([['content-type', 'text/plain']]),
    });
    const originalResponse = { marker: 'original' };
    const result = await csrf.protect(req, originalResponse);

    expect(result.success).toBe(true);
    // Excluded via skipContentTypes returns the original response unchanged
    expect(result.response).toBe(originalResponse);
  });

  it('POST with a non-skipped content-type still requires validation', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
      skipContentTypes: ['text/plain'],
    });

    const req = makeRequest({
      method: 'POST',
      headers: new Map([['content-type', 'application/json']]),
    });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token generation shapes per strategy
// ---------------------------------------------------------------------------

describe('CsrfProtection – token generation shapes', () => {
  it('double-submit: generates a hex nonce (no dots) as clientToken', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    // Pure hex nonce — no dots
    expect(result.token).toMatch(/^[a-f0-9]+$/);
  });

  it('signed-double-submit: generates an unsigned hex nonce as clientToken (no dots)', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'signed-double-submit',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    // Client token is the raw unsigned nonce
    expect(result.token).toMatch(/^[a-f0-9]+$/);
  });

  it('signed-double-submit: response cookies include both client cookie and signed server cookie', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'signed-double-submit',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});
    const response = result.response as Record<string, unknown>;
    const csrfResponse = response.csrfResponse as CsrfResponse;

    const cookies =
      csrfResponse.cookies instanceof Map
        ? csrfResponse.cookies
        : new Map(Object.entries(csrfResponse.cookies));

    // Client cookie (unsigned)
    expect(cookies.has('csrf-token')).toBe(true);
    // Server cookie (signed, httpOnly)
    expect(cookies.has('csrf-token-server')).toBe(true);

    const serverCookie = cookies.get('csrf-token-server')!;
    // Signed token has exactly one dot: {unsignedToken}.{signature}
    expect(serverCookie.value.split('.').length).toBe(2);
  });

  it('signed-token: generates a signed token with dots (3 parts)', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'signed-token',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    // Signed token format: {exp}.{nonce}.{signature}
    expect(result.token!.split('.').length).toBe(3);
  });

  it('origin-check: generates a nonce token (no dots)', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'origin-check',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    expect(result.token).toMatch(/^[a-f0-9]+$/);
  });

  it('hybrid: generates a signed token (3 parts, same as signed-token)', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'hybrid',
    });

    const req = makeRequest({ method: 'GET' });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
    expect(result.token!.split('.').length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// double-submit validation
// ---------------------------------------------------------------------------

describe('CsrfProtection – double-submit validation', () => {
  let csrf: CsrfProtection<CsrfRequest, Record<string, unknown>>;

  beforeEach(() => {
    csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'double-submit',
    });
  });

  it('POST with matching header token and cookie token succeeds', async () => {
    // First, obtain a token via GET
    const getReq = makeRequest({ method: 'GET' });
    const getResult = await csrf.protect(getReq, {});
    const token = getResult.token!;

    // Then submit it in a POST with matching cookie
    const postReq = makeRequest({
      method: 'POST',
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map([['csrf-token', token]]),
    });
    const postResult = await csrf.protect(postReq, {});

    expect(postResult.success).toBe(true);
  });

  it('POST with mismatched header token and cookie token fails', async () => {
    const getReq = makeRequest({ method: 'GET' });
    const getResult = await csrf.protect(getReq, {});
    const correctToken = getResult.token!;

    const postReq = makeRequest({
      method: 'POST',
      headers: new Map([['x-csrf-token', 'wrong-token']]),
      cookies: new Map([['csrf-token', correctToken]]),
    });
    const postResult = await csrf.protect(postReq, {});

    expect(postResult.success).toBe(false);
    expect(postResult.reason).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// origin-check strategy validation
// ---------------------------------------------------------------------------

describe('CsrfProtection – origin-check validation', () => {
  it('POST with an allowed origin succeeds', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost:3000'],
    });

    const req = makeRequest({
      method: 'POST',
      headers: new Map([['origin', 'http://localhost:3000']]),
    });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(true);
  });

  it('POST with a disallowed origin fails', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost:3000'],
    });

    const req = makeRequest({
      method: 'POST',
      headers: new Map([['origin', 'http://evil.example.com']]),
    });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
    expect(result.reason).toContain('not allowed');
  });

  it('POST with no origin header fails with missing origin reason', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      secret: TEST_SECRET,
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost:3000'],
    });

    const req = makeRequest({
      method: 'POST',
      headers: new Map(),
    });
    const result = await csrf.protect(req, {});

    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe.each(['signed-token', 'hybrid'] as const)('CsrfProtection – %s browser binding', (strategy) => {
  it('recovers after a rejected request rotates the cookie', async () => {
    const responses: CsrfResponse[] = [];
    const adapter = new MockAdapter();
    adapter.applyResponse = (res, response) => {
      responses.push(response);
      return { ...res, csrfResponse: response };
    };
    const csrf = new CsrfProtection(adapter, {
      strategy,
      secret: TEST_SECRET,
      allowedOrigins: ['http://localhost'],
    });
    const initial = await csrf.protect(makeRequest({ method: 'GET' }), {});
    if (!initial.token) throw new Error('Missing issued token');
    const submit = (token: string, cookie: string) => csrf.protect(makeRequest({
      method: 'POST',
      headers: new Map([['origin', 'http://localhost'], ['x-csrf-token', token]]),
      cookies: { 'csrf-token': cookie },
    }), {});

    const rejected = await submit('invalid', initial.token);
    expect(rejected.success).toBe(false);
    expect(rejected.token).toBeUndefined();
    const response = responses.at(-1);
    if (!response) throw new Error('Missing rejection response');
    const cookie = response.cookies instanceof Map
      ? response.cookies.get('csrf-token')?.value
      : response.cookies['csrf-token']?.value;
    const header = response.headers instanceof Map
      ? response.headers.get('x-csrf-token')
      : response.headers['x-csrf-token'];
    if (!cookie) throw new Error('Missing replacement cookie');
    expect(cookie).not.toBe(initial.token);
    expect(header).toBe(cookie);

    const refreshed = await csrf.protect(makeRequest({
      method: 'GET', cookies: { 'csrf-token': cookie },
    }), {});
    expect(refreshed.token).toBe(cookie);
    expect((await submit(cookie, cookie)).success).toBe(true);
  });

  it('preserves safe reuse and valid requests across response rotation, rejecting another browser', async () => {
    const csrf = new CsrfProtection(new MockAdapter(), {
      strategy,
      secret: TEST_SECRET,
      allowedOrigins: ['http://localhost'],
      cookie: { name: 'Custom-CSRF' },
    });
    const first = await csrf.protect(makeRequest({ method: 'GET' }), {});
    const second = await csrf.protect(makeRequest({ method: 'GET' }), {});
    expect(first.token).toBeDefined();
    expect(second.token).toBeDefined();
    if (!first.token || !second.token) throw new Error('Missing issued token');
    const reused = await csrf.protect(makeRequest({
      method: 'GET', cookies: { 'Custom-CSRF': first.token },
    }), {});
    expect(reused.token).toBe(first.token);
    const submit = (token: string, cookie: string) => csrf.protect(makeRequest({
      method: 'POST',
      headers: new Map([['origin', 'http://localhost'], ['x-csrf-token', token]]),
      cookies: { 'Custom-CSRF': cookie },
    }), {});
    expect((await submit(first.token, second.token)).success).toBe(false);
    const own = await submit(first.token, first.token);
    expect(own.success).toBe(true);
    expect(own.token).toBeDefined();
    if (!own.token) throw new Error('Missing rotated token');
    expect((await submit(own.token, own.token)).success).toBe(true);
  });
});
