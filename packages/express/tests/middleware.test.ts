import { CsrfError } from '@csrf-armor/core';
import type { Request, Response } from 'express';
import '../src/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { csrfMiddleware } from '../src/index.js';

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
        get: vi.fn((header) => {
          return undefined;
        }),
        header: vi.fn((header) => {
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
        cookie: vi.fn((name, value, options) => {
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
        url: '/api/data',
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
        url: '/api/data',
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
      let capturedToken: string | undefined;
      const customFieldName = 'xsrf';
      const cookieName = 'csrf';

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
        cookie: vi.fn((name, value, options) => {
          capturedToken = value;
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
      expect(capturedToken).toBeDefined();

      mockNext.mockClear();

      const postReq = {
        method: 'POST',
        url: '/api/data',
        headers: {
          origin: 'http://localhost',
          referer: 'http://localhost/form',
        },
        cookies: {
          [cookieName]: capturedToken,
        },
        body: {
          [customFieldName]: capturedToken,
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
        url: '/api/data',
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
});
