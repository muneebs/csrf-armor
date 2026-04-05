import { CsrfError } from '@csrf-armor/core';
import type { Request, Response } from 'express';
import '../src/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { csrfMiddleware } from '../src';

describe('CSRF Middleware', () => {
  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should allow GET requests and set CSRF token', async () => {
      const mockReq = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const mockRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.csrfToken).toBeDefined();
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('POST requests', () => {
    it('should validate POST requests with valid token', async () => {
      let capturedToken: string | undefined;

      const getReq = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn((_header) => {
          return undefined;
        }),
        header: vi.fn((_header) => {
          return undefined;
        }),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const getRes = {
        setHeader: vi.fn(),
        cookie: vi.fn((_name, value, _options) => {
          capturedToken = value;
          return getRes;
        }),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        allowedOrigins: ['http://localhost'],
        strategy: 'double-submit',
        cookie: {
          name: 'csrf',
          secure: false,
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        },
        token: {
          fieldName: '_csrf',
          headerName: 'csrf-token',
        },
      });

      await middleware(getReq, getRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(getReq.csrfToken).toBeDefined();
      expect(capturedToken).toBeDefined();

      mockNext.mockClear();

      const postReq = {
        method: 'POST',
        url: 'http://localhost/api/data',
        headers: {
          origin: 'http://localhost',
          referer: 'http://localhost/form',
          'x-csrf-token': capturedToken,
        },
        cookies: {
          csrf: capturedToken,
        },
        body: {
          _csrf: capturedToken,
        },
        get: vi.fn((header) => {
          const headerMap: Record<string, string> = {
            origin: 'http://localhost',
            referer: 'http://localhost/form',
          };
          return headerMap[header.toLowerCase()];
        }),
        header: vi.fn((header) => {
          const headerMap: Record<string, string> = {
            origin: 'http://localhost',
            referer: 'http://localhost/form',
          };
          return headerMap[header.toLowerCase()];
        }),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const postRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      await middleware(postReq, postRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject POST requests with invalid token', async () => {
      const mockReq = {
        method: 'POST',
        url: 'http://localhost/api/data',
        headers: {},
        cookies: {
          'csrf-token': 'invalid-token',
        },
        body: {
          _csrf: 'different-invalid-token',
        },
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const mockRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
      });

      let error: Error | undefined;
      try {
        await middleware(mockReq, mockRes, mockNext);
      } catch (err) {
        error = err as Error;
      }

      expect(error).toBeInstanceOf(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use custom token fieldName', async () => {
      const capturedCookies = new Map<string, string>();
      const customFieldName = 'xsrf';
      const cookieName = 'csrf-token'; // Use default cookie name

      const getReq = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const getRes = {
        setHeader: vi.fn(),
        cookie: vi.fn((name, value, _options) => {
          capturedCookies.set(name, value);
          return getRes;
        }),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        token: {
          fieldName: customFieldName,
        },
        allowedOrigins: ['http://localhost'],
      });

      await middleware(getReq, getRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(getReq.csrfToken).toBeDefined();
      expect(capturedCookies.size).toBeGreaterThan(0);

      // For signed-double-submit strategy, we should have both client and server cookies
      const clientToken = capturedCookies.get(cookieName);
      const serverToken = capturedCookies.get(`${cookieName}-server`);
      expect(clientToken).toBeDefined();
      expect(serverToken).toBeDefined();

      mockNext.mockClear();

      const postReq = {
        method: 'POST',
        url: 'http://localhost/api/data',
        headers: {
          origin: 'http://localhost',
          referer: 'http://localhost/form',
        },
        cookies: {
          [cookieName]: clientToken,
          [`${cookieName}-server`]: serverToken,
        },
        body: {
          [customFieldName]: clientToken,
        },
        get: vi.fn((header) => {
          const headerMap: Record<string, string> = {
            origin: 'http://localhost',
            referer: 'http://localhost/form',
          };
          return headerMap[header.toLowerCase()];
        }),
        header: vi.fn((header) => {
          const headerMap: Record<string, string> = {
            origin: 'http://localhost',
            referer: 'http://localhost/form',
          };
          return headerMap[header.toLowerCase()];
        }),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const postRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      await middleware(postReq, postRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should respect excludePaths option', async () => {
      const mockReq = {
        method: 'POST',
        url: '/excluded/path',
        headers: {},
        cookies: {},
        body: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const mockRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
        excludePaths: ['/excluded'],
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should use custom token fieldName and cookie name in full request cycle', async () => {
      const cookieName = 'csrf-token';
      const fieldName = 'xsrf';

      const getReq = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const getRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'double-submit',
        token: {
          fieldName,
        },
        cookie: {
          name: cookieName,
        },
      });

      await middleware(getReq, getRes, mockNext);
      const validToken = getReq.csrfToken;

      const cookieValue = (getRes.cookie as any).mock.calls[0][1];

      const postReq = {
        method: 'POST',
        url: 'http://localhost/api/data',
        headers: {},
        cookies: {
          [cookieName]: cookieValue,
        },
        body: {
          [fieldName]: validToken,
        },
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const postRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      await middleware(postReq, postRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Origin Check Strategy', () => {
    it('should validate origin header', async () => {
      const mockReq = {
        method: 'POST',
        url: '/api/data',
        headers: {
          origin: 'http://localhost:3000',
        },
        cookies: {},
        body: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const mockRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        strategy: 'origin-check',
        allowedOrigins: ['http://localhost:3000'],
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject invalid origin', async () => {
      const mockReq = {
        method: 'POST',
        url: '/api/data',
        headers: {
          origin: 'http://evil.com',
        },
        cookies: {},
        body: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
      } as unknown as Request;

      const mockRes = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const middleware = csrfMiddleware({
        strategy: 'origin-check',
        allowedOrigins: ['http://localhost:3000'],
      });

      let error: Error | undefined;
      try {
        await middleware(mockReq, mockRes, mockNext);
      } catch (err) {
        error = err as Error;
      }

      expect(error).toBeInstanceOf(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('HTTP method coverage', () => {
    const createMockReq = (method: string, extras: Partial<Request> = {}) =>
      ({
        method,
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
        ...extras,
      }) as unknown as Request;

    const createMockRes = () =>
      ({
        setHeader: vi.fn(),
        cookie: vi.fn(),
      }) as unknown as Response;

    it('should allow HEAD requests without validation', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'double-submit',
      });

      const req = createMockReq('HEAD');
      const res = createMockRes();
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should allow OPTIONS requests without validation', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'double-submit',
      });

      const req = createMockReq('OPTIONS');
      const res = createMockRes();
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject PUT requests without valid token', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
      });

      const req = createMockReq('PUT', {
        cookies: { 'csrf-token': 'invalid' },
      } as Partial<Request>);
      const res = createMockRes();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject DELETE requests without valid token', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
      });

      const req = createMockReq('DELETE', {
        cookies: { 'csrf-token': 'invalid' },
      } as Partial<Request>);
      const res = createMockRes();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject PATCH requests without valid token', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-double-submit',
      });

      const req = createMockReq('PATCH', {
        cookies: { 'csrf-token': 'invalid' },
      } as Partial<Request>);
      const res = createMockRes();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Signed-token strategy', () => {
    const createMockReq = (method: string, extras: Partial<Request> = {}) =>
      ({
        method,
        url: '/api/data',
        headers: {},
        cookies: {},
        get: vi.fn(),
        header: vi.fn(),
        accepts: vi.fn(),
        acceptsCharsets: vi.fn(),
        acceptsEncodings: vi.fn(),
        acceptsLanguages: vi.fn(),
        param: vi.fn(),
        is: vi.fn(),
        app: {},
        route: {},
        ...extras,
      }) as unknown as Request;

    const createMockRes = () =>
      ({
        setHeader: vi.fn(),
        cookie: vi.fn(),
      }) as unknown as Response;

    it('should generate signed token on GET and validate on POST', async () => {
      const secret = 'test-secret-key-32-chars-long-good';
      const middleware = csrfMiddleware({
        secret,
        strategy: 'signed-token',
      });

      // GET to obtain token
      const getReq = createMockReq('GET');
      const getRes = createMockRes();
      await middleware(getReq, getRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const signedToken = getReq.csrfToken;
      expect(signedToken).toBeDefined();
      // Signed tokens have dots (exp.nonce.signature)
      expect(signedToken!.split('.').length).toBe(3);

      mockNext.mockClear();

      // POST with valid signed token
      const postReq = createMockReq('POST', {
        headers: {
          'x-csrf-token': signedToken!,
        },
        cookies: {
          'csrf-token': signedToken!,
        },
      } as Partial<Request>);
      const postRes = createMockRes();

      await middleware(postReq, postRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject POST with invalid signed token', async () => {
      const middleware = csrfMiddleware({
        secret: 'test-secret-key-32-chars-long-good',
        strategy: 'signed-token',
      });

      const req = createMockReq('POST', {
        headers: {
          'x-csrf-token': 'invalid.token.here',
        },
      } as Partial<Request>);
      const res = createMockRes();

      await expect(middleware(req, res, mockNext)).rejects.toThrow(CsrfError);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
