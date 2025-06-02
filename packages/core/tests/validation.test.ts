import { describe, expect, it } from 'vitest';
import {
  validateDoubleSubmit,
  validateOrigin,
  validateRequest,
  validateSignedDoubleSubmit,
  validateSignedToken,
} from '../src';
import type { CsrfRequest, RequiredCsrfConfig } from '../src';
import { generateNonce, generateSignedToken, signUnsignedToken } from '../src';

const TEST_CONFIG: RequiredCsrfConfig = {
  strategy: 'hybrid',
  secret: 'test-secret-32-characters-long-123',
  token: {
    expiry: 3600,
    headerName: 'X-CSRF-Token',
    fieldName: 'csrf_token',
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
  skipContentTypes: [],
};

const mockGetTokenFromRequest = async (
  request: CsrfRequest,
  config: RequiredCsrfConfig
): Promise<string | undefined> => {
  const headers =
    request.headers instanceof Map
      ? request.headers
      : new Map(Object.entries(request.headers));
  return headers.get(config.token.headerName.toLowerCase());
};

describe('Validation', () => {
  describe('validateOrigin', () => {
    it('should validate allowed origin', () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['origin', 'http://localhost:3000']]),
        cookies: new Map(),
      };

      const config = {
        ...TEST_CONFIG,
        allowedOrigins: ['http://localhost:3000'],
      };

      const result = validateOrigin(request, config);
      expect(result.isValid).toBe(true);
    });

    it('should reject disallowed origin', () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['origin', 'http://evil.com']]),
        cookies: new Map(),
      };

      const result = validateOrigin(request, TEST_CONFIG);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });
  });

  describe('validateSignedToken', () => {
    it('should validate a valid signed token', async () => {
      const secret = 'test-secret';
      const token = await generateSignedToken(secret, 3600);

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', token]]),
        cookies: new Map(),
      };

      const config = {
        ...TEST_CONFIG,
        secret,
      };

      const result = await validateSignedToken(
        request,
        config,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when no token provided', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map(),
      };

      const result = await validateSignedToken(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No CSRF token provided');
    });
  });

  describe('validateDoubleSubmit', () => {
    it('should validate matching tokens', async () => {
      const token = 'test-token';
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', token]]),
        cookies: new Map([['csrf-token', token]]),
      };

      const result = await validateDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject mismatched tokens', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', 'token1']]),
        cookies: new Map([['csrf-token', 'token2']]),
      };

      const result = await validateDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Token mismatch');
    });
  });

  // UPDATED TESTS - New signed-double-submit behavior
  describe('validateSignedDoubleSubmit', () => {
    it('should validate with unsigned client token and signed server cookie', async () => {
      const unsignedToken = generateNonce(32);
      const signedServerToken = await signUnsignedToken(
        unsignedToken,
        TEST_CONFIG.secret
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]), // Client submits unsigned
        cookies: new Map([
          ['csrf-token', unsignedToken], // Client cookie (unsigned)
          ['csrf-token-server', signedServerToken], // Server cookie (signed)
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject when no client cookie found', async () => {
      const unsignedToken = generateNonce(32);
      const signedServerToken = await signUnsignedToken(
        unsignedToken,
        TEST_CONFIG.secret
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          // Missing client cookie
          ['csrf-token-server', signedServerToken],
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing CSRF cookies');
    });

    it('should reject when no server cookie found', async () => {
      const unsignedToken = generateNonce(32);

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          ['csrf-token', unsignedToken],
          // Missing server cookie
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing CSRF cookies');
    });

    it('should reject when submitted token does not match client cookie', async () => {
      const unsignedToken1 = generateNonce(32);
      const unsignedToken2 = generateNonce(32);
      const signedServerToken = await signUnsignedToken(
        unsignedToken1,
        TEST_CONFIG.secret
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken2]]), // Different token
        cookies: new Map([
          ['csrf-token', unsignedToken1],
          ['csrf-token-server', signedServerToken],
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Token mismatch');
    });

    it('should reject when client cookie does not match server cookie', async () => {
      const unsignedToken1 = generateNonce(32);
      const unsignedToken2 = generateNonce(32);
      const signedServerToken = await signUnsignedToken(
        unsignedToken2,
        TEST_CONFIG.secret
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken1]]),
        cookies: new Map([
          ['csrf-token', unsignedToken1], // Matches header
          ['csrf-token-server', signedServerToken], // But server cookie signs different token
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Cookie integrity check failed');
    });

    it('should reject invalid server cookie signature', async () => {
      const unsignedToken = generateNonce(32);
      const invalidSignedToken = 'invalid.signature';

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          ['csrf-token', unsignedToken],
          ['csrf-token-server', invalidSignedToken],
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('CSRF token is invalid: Invalid signature');
    });

    it('should reject when server cookie signed with wrong secret', async () => {
      const unsignedToken = generateNonce(32);
      const wrongSignedToken = await signUnsignedToken(
        unsignedToken,
        'wrong-secret'
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          ['csrf-token', unsignedToken],
          ['csrf-token-server', wrongSignedToken],
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('CSRF token is invalid: Invalid signature');
    });

    // LEGACY TEST - This behavior should now fail
    it('should reject legacy signed-double-submit pattern (signed token in client cookie)', async () => {
      const unsignedToken = generateNonce(32);
      const signedToken = await signUnsignedToken(
        unsignedToken,
        TEST_CONFIG.secret
      );

      // Old pattern: unsigned in header, signed in client cookie
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          ['csrf-token', signedToken], // This is the old, broken pattern
        ]),
      };

      const result = await validateSignedDoubleSubmit(
        request,
        TEST_CONFIG,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Missing CSRF cookies'); // No server cookie
    });
  });

  describe('validateRequest', () => {
    it('should route to correct validation strategy', async () => {
      const token = 'test-token';
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', token]]),
        cookies: new Map([['csrf-token', token]]),
      };

      const config = {
        ...TEST_CONFIG,
        strategy: 'double-submit' as const,
      };

      const result = await validateRequest(
        request,
        config,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate signed-double-submit strategy correctly', async () => {
      const unsignedToken = generateNonce(32);
      const signedServerToken = await signUnsignedToken(
        unsignedToken,
        TEST_CONFIG.secret
      );

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', unsignedToken]]),
        cookies: new Map([
          ['csrf-token', unsignedToken],
          ['csrf-token-server', signedServerToken],
        ]),
      };

      const config = {
        ...TEST_CONFIG,
        strategy: 'signed-double-submit' as const,
      };

      const result = await validateRequest(
        request,
        config,
        mockGetTokenFromRequest
      );
      expect(result.isValid).toBe(true);
    });
  });
});
