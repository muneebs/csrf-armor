import type { CsrfRequest, CsrfResponse, RequiredCsrfConfig } from '@csrf-armor/core';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpressAdapter } from '../src/adapter.js';

const TEST_CONFIG: RequiredCsrfConfig = {
  strategy: 'signed-double-submit',
  secret: 'test-secret',
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
  allowedOrigins: [],
  excludePaths: [],
  skipContentTypes: [],
};

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter;

  beforeEach(() => {
    adapter = new ExpressAdapter();
  });

  describe('extractRequest', () => {
    it('should extract request data correctly', () => {
      const mockRequest = {
        method: 'POST',
        url: '/api/data',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'test-token',
        },
        cookies: {
          'csrf-token': 'test-token',
          'session-id': 'test-session',
        },
        body: { foo: 'bar' },
        // Add required Express.Request methods
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

      const result = adapter.extractRequest(mockRequest);

      expect(result.method).toBe('POST');
      expect(result.url).toBe('/api/data');
      expect(result.headers instanceof Map).toBe(true);
      expect(result.cookies instanceof Map).toBe(true);
      expect(result.body).toEqual({ foo: 'bar' });

      const headers = result.headers as Map<string, string>;
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-csrf-token')).toBe('test-token');

      const cookies = result.cookies as Map<string, string>;
      expect(cookies.get('csrf-token')).toBe('test-token');
      expect(cookies.get('session-id')).toBe('test-session');
    });

    it('should handle missing cookies and body', () => {
      const mockRequest = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        // Add required Express.Request methods
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

      const result = adapter.extractRequest(mockRequest);

      expect(result.method).toBe('GET');
      expect(result.url).toBe('/api/data');
      expect(result.headers instanceof Map).toBe(true);
      expect(result.cookies instanceof Map).toBe(true);
      expect(result.cookies.size).toBe(0);
      expect(result.body).toBeUndefined();
    });
  });

  describe('applyResponse', () => {
    it('should apply headers and cookies correctly', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const csrfResponse: CsrfResponse = {
        headers: new Map([
          ['x-csrf-token', 'new-token'],
          ['content-type', 'application/json'],
        ]),
        cookies: new Map([
          [
            'csrf-token',
            {
              value: 'new-token',
              options: {
                httpOnly: true,
                secure: true,
                sameSite: 'strict' as const,
                maxAge: 3600,
              },
            },
          ],
        ]),
      };

      adapter.applyResponse(mockResponse, csrfResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-csrf-token',
        'new-token'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'content-type',
        'application/json'
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf-token',
        'new-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600000, // Express expects milliseconds
        })
      );
    });

    it('should handle plain objects for headers and cookies', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const csrfResponse: CsrfResponse = {
        headers: {
          'x-csrf-token': 'new-token',
        },
        cookies: {
          'csrf-token': {
            value: 'new-token',
            options: {
              httpOnly: true,
            },
          },
        },
      };

      adapter.applyResponse(mockResponse, csrfResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-csrf-token',
        'new-token'
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf-token',
        'new-token',
        expect.objectContaining({
          httpOnly: true,
        })
      );
    });

    it('should handle empty headers and cookies', () => {
      const mockResponse = {
        setHeader: vi.fn(),
        cookie: vi.fn(),
      } as unknown as Response;

      const csrfResponse: CsrfResponse = {
        headers: {},
        cookies: {},
      };

      adapter.applyResponse(mockResponse, csrfResponse);

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });
  });

  describe('getTokenFromRequest', () => {
    it('should extract token from header', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map([['x-csrf-token', 'header-token']]),
        cookies: new Map(),
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('header-token');
    });

    it('should extract token from cookie when header is missing', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('cookie-token');
    });

    it('should extract token from query parameter when header and cookie are missing', async () => {
      const request: CsrfRequest = {
        method: 'GET',
        url: '/api/data?csrf_token=query-token',
        headers: new Map(),
        cookies: new Map(),
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('query-token');
    });

    it('should extract token from form body when all others are missing', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map(),
        cookies: new Map(),
        body: { csrf_token: 'body-token' },
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('body-token');
    });

    it('should return undefined when token is not found anywhere', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map(),
        cookies: new Map(),
        body: { other_field: 'some-value' },
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBeUndefined();
    });

    it('should give header priority over cookie', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map([['x-csrf-token', 'header-token']]),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: { csrf_token: 'body-token' },
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('header-token');
    });

    it('should give cookie priority over query parameter', async () => {
      const request: CsrfRequest = {
        method: 'GET',
        url: '/api/data?csrf_token=query-token',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('cookie-token');
    });

    it('should give query parameter priority over body', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data?csrf_token=query-token',
        headers: new Map(),
        cookies: new Map(),
        body: { csrf_token: 'body-token' },
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('query-token');
    });

    it('should handle object-format headers (not Map)', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: { 'x-csrf-token': 'header-token' },
        cookies: new Map(),
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('header-token');
    });

    it('should handle object-format cookies (not Map)', async () => {
      const request: CsrfRequest = {
        method: 'POST',
        url: '/api/data',
        headers: new Map(),
        cookies: { 'csrf-token': 'cookie-token' },
      };

      const result = await adapter.getTokenFromRequest(request, TEST_CONFIG);

      expect(result).toBe('cookie-token');
    });
  });
});
