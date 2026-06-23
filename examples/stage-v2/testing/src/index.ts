import {
  generateSecureSecret,
  generateSignedToken,
  signUnsignedToken,
} from '@csrf-armor/core';
import type {
  CsrfConfig,
  CsrfRequest,
  CsrfResponse,
  CsrfStrategy,
  RequiredCsrfConfig,
} from '@csrf-armor/core';

/** A secret that satisfies the v2 minimum length requirement. */
export const TEST_SECRET='this-is-a-32-character-test-secret-key';

/** Default test configuration. */
export const createTestConfig = (overrides?: Partial<CsrfConfig>): CsrfConfig => ({
  secret: TEST_SECRET,
  strategy: 'hybrid',
  cookie: {
    name: 'csrf-token',
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  },
  token: {
    expiry: 3600,
    headerName: 'X-CSRF-Token',
    fieldName: 'csrf_token',
  },
  ...overrides,
});

/** Builds a CsrfRequest for testing. */
export function createCsrfRequest(
  options: Partial<CsrfRequest> = {}
): CsrfRequest {
  return {
    url: 'https://example.com/api/form',
    method: 'POST',
    headers: new Map<string, string>(),
    cookies: new Map<string, string>(),
    body: null,
    ...options,
  };
}

/** In-memory cookie jar for use in tests. */
export class TestCookieJar {
  private readonly cookies = new Map<string, string>();

  set(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  all(): Map<string, string> {
    return new Map(this.cookies);
  }

  headerValue(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join('; ');
  }
}

/** Applies CsrfResponse cookies to a TestCookieJar. */
export function applyCsrfResponseCookies(
  jar: TestCookieJar,
  response: CsrfResponse,
  filter?: (name: string) => boolean
): void {
  for (const [name, { value }] of response.cookies.entries()) {
    if (!filter || filter(name)) {
      jar.set(name, value);
    }
  }
}

/** Generates a valid signed token for the given strategy and optional session. */
export async function createValidToken(
  strategy: CsrfStrategy,
  secret: string = TEST_SECRET,
  sessionId?: string
): Promise<string> {
  switch (strategy) {
    case 'signed-double-submit':
    case 'origin-check': {
      const unsigned = crypto.randomUUID();
      return signUnsignedToken(unsigned, secret);
    }

    case 'signed-token':
    case 'hybrid':
    case 'fetch-metadata':
    default: {
      return generateSignedToken(secret, 3600, sessionId);
    }
  }
}

/** Creates a valid signed double-submit pair for tests. */
export async function createDoubleSubmitPair(secret: string = TEST_SECRET): Promise<{
  clientToken: string;
  serverToken: string;
}> {
  const clientToken = crypto.randomUUID();
  const serverToken = await signUnsignedToken(clientToken, secret);
  return { clientToken, serverToken };
}

/** Assert helpers for vitest-like test runners. */
export function expectTokenHeader(response: CsrfResponse): string {
  const token = response.headers.get('x-csrf-token');
  if (!token) {
    throw new Error('Expected CSRF response to include x-csrf-token header');
  }
  return token;
}

export function expectNoClientTokenCookie(response: CsrfResponse): void {
  for (const name of response.cookies.keys()) {
    if (!name.endsWith('-server')) {
      throw new Error(`Expected no client cookie, but found ${name}`);
    }
  }
}

export {
  generateSecureSecret,
  generateSignedToken,
  signUnsignedToken,
};
