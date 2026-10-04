import { describe, expect, it } from 'vitest';
import type {
  CsrfAdapter,
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '../src';
import { resolveCookieName } from '../src/cookie-prefix.js';
import { CsrfProtection } from '../src/csrf.js';
import { CsrfConfigError } from '../src/errors.js';

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
    const headers = req.headers as Map<string, string>;
    return headers.get(config.token.headerName.toLowerCase());
  }
}

type IssuedCookie = { value: string; options?: Record<string, unknown> };

const TEST_SECRET = 'test-secret-for-csrf-tests-1234';

function create(
  cookie: CsrfConfig['cookie'],
  strategy: CsrfConfig['strategy'] = 'signed-double-submit'
) {
  return new CsrfProtection(new MockAdapter(), {
    secret: TEST_SECRET,
    strategy,
    cookie,
  });
}

function request(
  overrides: Partial<CsrfRequest> & { method: string }
): CsrfRequest {
  return {
    url: 'http://localhost/api/data',
    headers: new Map(),
    cookies: new Map(),
    ...overrides,
  };
}

/** Returns the named cookie, failing the test if it was not issued. */
function cookie(cookies: Map<string, IssuedCookie>, name: string) {
  const found = cookies.get(name);
  if (!found) throw new Error(`cookie ${name} was not issued`);
  return found;
}

async function issue(
  csrf: CsrfProtection<CsrfRequest, Record<string, unknown>>
) {
  const result = await csrf.protect(request({ method: 'GET' }), {});
  const csrfResponse = (result.response as Record<string, unknown>)
    .csrfResponse as CsrfResponse;
  return {
    token: result.token ?? '',
    cookies: csrfResponse.cookies as Map<string, IssuedCookie>,
  };
}

describe('resolveCookieName', () => {
  it('returns the default name without a prefix', () => {
    expect(resolveCookieName()).toBe('csrf-token');
    expect(resolveCookieName({ prefix: false })).toBe('csrf-token');
  });

  it('prepends the prefix to the default or custom name', () => {
    expect(resolveCookieName({ prefix: '__Host-' })).toBe('__Host-csrf-token');
    expect(resolveCookieName({ prefix: '__Secure-', name: 'xsrf' })).toBe(
      '__Secure-xsrf'
    );
  });
});

describe('cookie.prefix', () => {
  it('keeps the existing names when no prefix is set', async () => {
    const { cookies } = await issue(create(undefined));
    expect([...cookies.keys()]).toEqual(['csrf-token', 'csrf-token-server']);
  });

  it('prefixes both the client and the server cookie', async () => {
    const { cookies } = await issue(create({ prefix: '__Host-' }));
    expect([...cookies.keys()]).toEqual([
      '__Host-csrf-token',
      '__Host-csrf-token-server',
    ]);
    const options = cookie(cookies, '__Host-csrf-token').options ?? {};
    expect(options.secure).toBe(true);
    expect(options.path).toBe('/');
    expect(options.domain).toBeUndefined();
  });

  it('validates a request carrying the prefixed cookies', async () => {
    const csrf = create({ prefix: '__Host-' });
    const { token, cookies } = await issue(csrf);
    const serverValue = cookie(cookies, '__Host-csrf-token-server').value;

    const post = await csrf.protect(
      request({
        method: 'POST',
        headers: new Map([['x-csrf-token', token]]),
        cookies: new Map([
          ['__Host-csrf-token', token],
          ['__Host-csrf-token-server', serverValue],
        ]),
      }),
      {}
    );
    expect(post.success).toBe(true);
  });

  it('ignores unprefixed cookies once a prefix is set', async () => {
    const csrf = create({ prefix: '__Host-' });
    const { token, cookies } = await issue(csrf);
    const serverValue = cookie(cookies, '__Host-csrf-token-server').value;

    const post = await csrf.protect(
      request({
        method: 'POST',
        headers: new Map([['x-csrf-token', token]]),
        cookies: new Map([
          ['csrf-token', token],
          ['csrf-token-server', serverValue],
        ]),
      }),
      {}
    );
    expect(post.success).toBe(false);
  });

  it('allows __Secure- with a domain and a non-root path', () => {
    expect(() =>
      create({ prefix: '__Secure-', domain: 'example.com', path: '/app' })
    ).not.toThrow();
  });

  it.each([
    [{ prefix: '__Host-', domain: 'example.com' }, /cookie\.domain/],
    [{ prefix: '__Host-', path: '/app' }, /cookie\.path/],
    [{ prefix: '__Host-', secure: false }, /cookie\.secure/],
    [{ prefix: '__Secure-', secure: false }, /cookie\.secure/],
    [{ prefix: '__Host-', name: '__Host-csrf' }, /not both/],
    [{ name: '__Host-csrf', domain: 'example.com' }, /cookie\.domain/],
    [{ name: '__host-csrf', path: '/app' }, /cookie\.path/],
    [{ name: '__Secure-csrf', secure: false }, /cookie\.secure/],
    [{ name: '__Host-Http-csrf' }, /HttpOnly/],
    [{ name: '__Http-csrf' }, /HttpOnly/],
  ] as const)('throws CsrfConfigError for %o', (options, message) => {
    expect(() => create(options)).toThrow(CsrfConfigError);
    expect(() => create(options)).toThrow(message);
  });

  it('does not validate when prefix is false', () => {
    expect(() =>
      create({ prefix: false, domain: 'example.com', secure: false })
    ).not.toThrow();
  });
});
