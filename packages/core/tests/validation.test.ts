import { describe, expect, it } from 'vitest';
import {
  type CsrfRequest,
  type RequiredCsrfConfig,
  generateNonce,
  generateSignedToken,
  signUnsignedToken,
  validateContentType,
  validateFetchMetadata,
  validateOrigin,
  validateRequest,
  validateSignedToken,
} from '../src/index.js';

const TEST_SECRET='test-secret-32-characters-long-123';

const TEST_CONFIG: RequiredCsrfConfig = {
  strategy: 'hybrid',
  secret: TEST_SECRET,
  previousSecrets: [],
  token: {
    expiry: 3600,
    headerName: 'X-CSRF-Token',
    fieldName: 'csrf_token',
    reissueThreshold: 500,
  },
  cookie: {
    name: 'csrf-token',
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  },
  allowedOrigins: ['http://localhost'],
  excludePaths: [],
  contentType: {
    enforcePresence: false,
    allowedTypes: ['application/json', 'application/x-www-form-urlencoded'],
    skipValidation: [],
  },
  hostCookiePrefix: false,
  rotateOnUse: false,
};

const mockGetTokenFromRequest = async (
  request: CsrfRequest,
  config: { token: { headerName: string; fieldName: string }; cookie: { name: string } }
): Promise<string | undefined> => {
  const headers =
    request.headers instanceof Map
      ? request.headers
      : new Map(Object.entries(request.headers));
  const headerValue = headers.get(config.token.headerName.toLowerCase());
  if (headerValue) return headerValue;

  const cookies =
    request.cookies instanceof Map
      ? request.cookies
      : new Map(Object.entries(request.cookies ?? {}));
  return cookies.get(config.cookie.name);
};

describe('validateOrigin', () => {
  it('accepts allowed origin', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://localhost:3000']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateOrigin(request, {
      ...TEST_CONFIG,
      allowedOrigins: ['http://localhost:3000'],
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects disallowed origin', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://evil.com']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateOrigin(request, TEST_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not allowed');
  });

  it('rejects null origin', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'null']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateOrigin(request, TEST_CONFIG);
    expect(result.isValid).toBe(false);
  });

  it('falls back to referer', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['referer', 'http://localhost/page']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateOrigin(request, TEST_CONFIG);
    expect(result.isValid).toBe(true);
  });

  it('returns invalid when both origin and referer are missing', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map(),
      body: null,
    };

    const result = validateOrigin(request, TEST_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });
});

describe('validateSignedToken', () => {
  it('validates a valid signed token', async () => {
    const token = await generateSignedToken(TEST_SECRET, 3600);
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateSignedToken(request, TEST_CONFIG, mockGetTokenFromRequest);
    expect(result.isValid).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const token = await generateSignedToken(TEST_SECRET, -1);
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateSignedToken(request, TEST_CONFIG, mockGetTokenFromRequest);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('rejects missing tokens', async () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map(),
      body: null,
    };

    const result = await validateSignedToken(request, TEST_CONFIG, mockGetTokenFromRequest);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/no csrf token/i);
  });

  it('validates session-bound tokens when sessionId matches', async () => {
    const token = await generateSignedToken(TEST_SECRET, 3600, 'session-1');
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateSignedToken(
      request,
      TEST_CONFIG,
      mockGetTokenFromRequest,
      'session-1'
    );
    expect(result.isValid).toBe(true);
  });

  it('rejects session-bound tokens when sessionId differs', async () => {
    const token = await generateSignedToken(TEST_SECRET, 3600, 'session-1');
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', token]]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateSignedToken(
      request,
      TEST_CONFIG,
      mockGetTokenFromRequest,
      'session-2'
    );
    expect(result.isValid).toBe(false);
  });
});

describe('validateFetchMetadata', () => {
  it('passes safe methods even for cross-site', () => {
    const request: CsrfRequest = {
      method: 'GET',
      url: 'http://localhost/api',
      headers: new Map([['sec-fetch-site', 'cross-site']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateFetchMetadata(request, TEST_CONFIG);
    expect(result.isValid).toBe(true);
  });

  it('passes when sec-fetch-site header is absent', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map(),
      body: null,
    };

    const result = validateFetchMetadata(request, TEST_CONFIG);
    expect(result.isValid).toBe(true);
  });

  it('rejects cross-site unsafe methods', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['sec-fetch-site', 'cross-site']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateFetchMetadata(request, TEST_CONFIG);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/cross-site/i);
  });

  it('accepts same-origin unsafe methods', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['sec-fetch-site', 'same-origin']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateFetchMetadata(request, TEST_CONFIG);
    expect(result.isValid).toBe(true);
  });
});

describe('validateContentType', () => {
  it('allows safe methods without content-type', () => {
    const request: CsrfRequest = {
      method: 'GET',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map(),
      body: null,
    };

    const result = validateContentType(request, TEST_CONFIG);
    expect(result.isValid).toBe(true);
  });

  it('rejects disallowed content types when enforcement is enabled', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['content-type', 'text/plain']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateContentType(
      request,
      { ...TEST_CONFIG, contentType: { ...TEST_CONFIG.contentType, enforcePresence: true } }
    );
    expect(result.isValid).toBe(false);
  });

  it('allows configured content types', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['content-type', 'application/json']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateContentType(
      request,
      { ...TEST_CONFIG, contentType: { ...TEST_CONFIG.contentType, enforcePresence: true } }
    );
    expect(result.isValid).toBe(true);
  });

  it('skips validation for configured types', () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['content-type', 'multipart/form-data']]),
      cookies: new Map(),
      body: null,
    };

    const result = validateContentType(request, {
      ...TEST_CONFIG,
      contentType: {
        ...TEST_CONFIG.contentType,
        enforcePresence: true,
        skipValidation: ['multipart/form-data'],
      },
    });
    expect(result.isValid).toBe(true);
  });
});

describe('validateRequest routing', () => {
  it('validates signed-double-submit strategy', async () => {
    const unsignedToken = generateNonce(32);
    const signedServerToken = await signUnsignedToken(unsignedToken, TEST_SECRET);

    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', unsignedToken]]),
      cookies: new Map([
        ['csrf-token', unsignedToken],
        ['csrf-token-server', signedServerToken],
      ]),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'signed-double-submit' },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(true);
  });

  it('validates origin-check strategy', async () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://localhost']]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'origin-check' },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(true);
  });
});

describe('validateSignedDoubleSubmit edge cases', () => {
  it('rejects when cookies are missing', async () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', 'token']]),
      cookies: new Map(),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'signed-double-submit' },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/missing csrf cookies/i);
  });

  it('rejects when submitted token is missing', async () => {
    const unsigned = generateNonce(32);
    const signed = await signUnsignedToken(unsigned, TEST_SECRET);
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map([
        ['csrf-token', unsigned],
        ['csrf-token-server', signed],
      ]),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'signed-double-submit' },
      async () => undefined
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/no csrf token/i);
  });

  it('rejects tampered unsigned cookie', async () => {
    const unsigned = generateNonce(32);
    const signed = await signUnsignedToken(unsigned, TEST_SECRET);
    const tampered = 'b'.repeat(32);

    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', tampered]]),
      cookies: new Map([
        ['csrf-token', tampered],
        ['csrf-token-server', signed],
      ]),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'signed-double-submit' },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/integrity check failed|token mismatch/i);
  });

  it('rejects with invalid server token signature', async () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['x-csrf-token', 'unsigned']]),
      cookies: new Map([
        ['csrf-token', 'unsigned'],
        ['csrf-token-server', 'invalid.signature'],
      ]),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'signed-double-submit' },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(false);
  });
});

describe('validateRequest invalid strategy', () => {
  it('returns invalid for unknown strategy', async () => {
    const request: CsrfRequest = {
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map(),
      cookies: new Map(),
      body: null,
    };

    const result = await validateRequest(
      request,
      { ...TEST_CONFIG, strategy: 'unknown' as unknown as RequiredCsrfConfig['strategy'] },
      mockGetTokenFromRequest
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/invalid strategy/i);
  });
});

