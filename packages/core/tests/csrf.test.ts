import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCsrfProtection,
  type CsrfRequest,
  type CsrfResponse,
  type CsrfAdapter,
} from '../src/index.js';

const SECRET='demo-secret-key-32-characters-exact';

/** Simple in-memory adapter for unit tests. */
class TestAdapter implements CsrfAdapter<CReq, CRes> {
  private headers = new Map<string, string>();
  private cookies = new Map<string, string>();

  constructor(state?: { headers?: Map<string, string>; cookies?: Map<string, string> }) {
    this.headers = state?.headers ?? new Map<string, string>();
    this.cookies = state?.cookies ?? new Map<string, string>();
    this.getTokenFromRequest = this.getTokenFromRequest.bind(this);
  }

  cloneWithState(state: { headers?: Map<string, string>; cookies?: Map<string, string> }): TestAdapter {
    return new TestAdapter({
      headers: new Map([...this.headers, ...(state.headers ?? new Map())]),
      cookies: new Map([...this.cookies, ...(state.cookies ?? new Map())]),
    });
  }

  extractRequest(): CReq {
    return {
      method: 'POST',
      url: 'https://example.com/api/form',
      headers: new Map(this.headers),
      cookies: new Map(this.cookies),
      body: null,
    };
  }

  async getTokenFromRequest(request: CsrfRequest, _config: RequiredCsrfConfig): Promise<string | undefined> {
    const headers =
      request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers ?? {}));
    const headerValue = headers.get('x-csrf-token');
    if (headerValue) return headerValue;

    const cookies =
      request.cookies instanceof Map
        ? request.cookies
        : new Map(Object.entries(request.cookies ?? {}));
    return cookies.get('csrf-token');
  }

  applyResponse(response: CRes, csrfResponse: CsrfResponse): CRes {
    for (const [name, { value, options }] of csrfResponse.cookies.entries()) {
      response.cookies.set(name, value);
      if (options?.httpOnly) {
        response.httpOnlyCookies.set(name, value);
      }
    }
    for (const [name, value] of csrfResponse.headers.entries()) {
      response.headers.set(name.toLowerCase(), value);
    }
    return response;
  }
}

interface CReq {
  method: string;
  url: string;
  headers: Map<string, string>;
  cookies: Map<string, string>;
  body: unknown;
}

interface CRes {
  headers: Map<string, string>;
  cookies: Map<string, string>;
  httpOnlyCookies: Map<string, string>;
}

function createResponse(): CRes {
  return {
    headers: new Map<string, string>(),
    cookies: new Map<string, string>(),
    httpOnlyCookies: new Map<string, string>(),
  };
}

let adapter: TestAdapter;

beforeEach(() => {
  adapter = new TestAdapter();
});

describe('CsrfProtection', () => {
  it('issues a token on GET requests', async () => {
    const protection = createCsrfProtection(adapter, {
      secret: SECRET,
      strategy: 'hybrid',
    });

    const response = createResponse();
    const result = await protection.protect(
      { ...adapter.extractRequest(), method: 'GET' },
      response
    );

    if (!result.success) console.log('GET issue reason:', result.reason);
    expect(result.success).toBe(true);
    expect(response.cookies.get('csrf-token')).toBeDefined();
    expect(response.headers.get('x-csrf-token')).toBeDefined();
  });

  it('rejects POST requests without a token', async () => {
    const protection = createCsrfProtection(adapter, {
      secret: SECRET,
      strategy: 'hybrid',
    });

    const response = createResponse();
    const result = await protection.protect(adapter.extractRequest(), response);

    expect(result.success).toBe(false);
    expect(response.cookies.get('csrf-token')).toBeUndefined();
  });

  it('accepts a valid token on POST requests', async () => {
    const issueAdapter = new TestAdapter();
    const issueProtection = createCsrfProtection(issueAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
    });

    const issueResponse = createResponse();
    await issueProtection.protect(
      { ...issueAdapter.extractRequest(), method: 'GET' },
      issueResponse
    );

    const token = issueResponse.headers.get('x-csrf-token')!;
    const validateAdapter = issueAdapter.cloneWithState({
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map([['csrf-token', token]]),
    });
    const validateProtection = createCsrfProtection(validateAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
    });

    const response = createResponse();
    const result = await validateProtection.protect(
      validateAdapter.extractRequest(),
      response
    );

    if (!result.success) console.log('POST accept reason:', result.reason);
    expect(result.success).toBe(true);
    expect(response.headers.get('x-csrf-token')).toBeDefined();
  });

  it('rejects cross-site POSTs in fetch-metadata mode', async () => {
    const protection = createCsrfProtection(adapter, {
      secret: SECRET,
      strategy: 'fetch-metadata',
    });

    const req = adapter.extractRequest();
    req.headers.set('sec-fetch-site', 'cross-site');

    const response = createResponse();
    const result = await protection.protect(req, response);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/cross-site/i);
  });

  it('supports session-bound tokens', async () => {
    let issueAdapter = new TestAdapter();
    issueAdapter = issueAdapter.cloneWithState({
      cookies: new Map([['session', 'user-1']]),
    });

    const issueProtection = createCsrfProtection(issueAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      getSessionId: (req) => req.cookies.get('session') ?? undefined,
    });

    const issueResponse = createResponse();
    await issueProtection.protect(
      { ...issueAdapter.extractRequest(), method: 'GET' },
      issueResponse
    );
    const token = issueResponse.headers.get('x-csrf-token')!;

    // Validate with same session
    const validateAdapter = issueAdapter.cloneWithState({
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map([
        ['csrf-token', token],
        ['session', 'user-1'],
      ]),
    });
    const validateProtection = createCsrfProtection(validateAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      getSessionId: (req) => req.cookies.get('session') ?? undefined,
    });

    const response = createResponse();
    const result = await validateProtection.protect(
      validateAdapter.extractRequest(),
      response
    );
    expect(result.success).toBe(true);

    // Validate with different session
    const badAdapter = issueAdapter.cloneWithState({
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map([
        ['csrf-token', token],
        ['session', 'user-2'],
      ]),
    });
    const badProtection = createCsrfProtection(badAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      getSessionId: (req) => req.cookies.get('session') ?? undefined,
    });
    const response2 = createResponse();
    const result2 = await badProtection.protect(
      badAdapter.extractRequest(),
      response2
    );
    expect(result2.success).toBe(false);
  });

  it('enforces content-type restrictions when enabled', async () => {
    const protection = createCsrfProtection(adapter, {
      secret: SECRET,
      strategy: 'hybrid',
      contentType: {
        enforcePresence: true,
        allowedTypes: ['application/json'],
      },
    });

    const req = adapter.extractRequest();
    req.headers.set('content-type', 'text/plain');

    const response = createResponse();
    const result = await protection.protect(req, response);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/content.type/i);
  });

  it('rotates tokens when rotateOnUse is enabled', async () => {
    const issueAdapter = new TestAdapter();
    const issueProtection = createCsrfProtection(issueAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      rotateOnUse: true,
    });

    const issueResponse = createResponse();
    await issueProtection.protect(
      { ...issueAdapter.extractRequest(), method: 'GET' },
      issueResponse
    );
    const token1 = issueResponse.headers.get('x-csrf-token')!;

    const validateAdapter = issueAdapter.cloneWithState({
      headers: new Map([['x-csrf-token', token1]]),
      cookies: new Map([['csrf-token', token1]]),
    });
    const validateProtection = createCsrfProtection(validateAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      rotateOnUse: true,
    });

    const response1 = createResponse();
    const result1 = await validateProtection.protect(
      validateAdapter.extractRequest(),
      response1
    );
    expect(result1.success).toBe(true);
    const token2 = response1.headers.get('x-csrf-token')!;
    expect(token2).not.toBe(token1);

    // token1 should still be accepted within the rotation grace period
    const graceAdapter = issueAdapter.cloneWithState({
      headers: new Map([['x-csrf-token', token1]]),
      cookies: new Map([['csrf-token', token1]]),
    });
    const graceProtection = createCsrfProtection(graceAdapter, {
      secret: SECRET,
      strategy: 'hybrid',
      rotateOnUse: true,
    });
    const responseGrace = createResponse();
    const graceResult = await graceProtection.protect(
      graceAdapter.extractRequest(),
      responseGrace
    );
    expect(graceResult.success).toBe(true);
  });
});

export {};
