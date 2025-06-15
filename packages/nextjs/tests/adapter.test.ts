import type {
  CookieOptions,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives';
import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextjsAdapter } from '../src/adapter.js';

describe('NextjsAdapter', () => {
  let adapter: NextjsAdapter;

  beforeEach(() => {
    adapter = new NextjsAdapter();
  });

  describe('extractRequest', () => {
    it('should extract request data correctly', () => {
      // Create a mock NextRequest
      const mockCookies = {
        getAll: vi.fn().mockReturnValue([
          { name: 'csrf-token', value: 'test-token' },
          { name: 'session-id', value: 'test-session' },
        ]),
      };

      // Create headers using the Headers class
      const headers = new Headers();
      headers.set('content-type', 'application/json');
      headers.set('x-csrf-token', 'test-token');

      const mockRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: headers,
        cookies: mockCookies,
        body: JSON.stringify({ foo: 'bar' }),
      } as unknown as NextRequest;

      // Extract the request
      const result = adapter.extractRequest(mockRequest);

      // Verify the result
      expect(result.method).toBe('POST');
      expect(result.url).toBe('http://localhost/api');
      expect(result.headers).toBe(mockRequest.headers);

      // Verify cookies are correctly extracted as a Map
      expect(result.cookies instanceof Map).toBe(true);

      // Check if keys exist in the Map
      const cookiesMap = result.cookies as Map<string, string>;
      expect(cookiesMap.has('csrf-token')).toBe(true);
      expect(cookiesMap.has('session-id')).toBe(true);

      // Get values from the Map
      expect(cookiesMap.get('csrf-token')).toBe('test-token');
      expect(cookiesMap.get('session-id')).toBe('test-session');

      expect(result.body).toBe(mockRequest);
    });
  });

  describe('applyResponse', () => {
    it('should apply headers and cookies from Map correctly', () => {
      // Create mock NextResponse
      const mockResponse = {
        headers: {
          set: vi.fn(),
        },
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse;

      // Create mock CsrfResponse with Map headers and cookies
      const csrfResponse: CsrfResponse = {
        headers: new Map([
          ['x-csrf-token', 'new-token'],
          ['content-type', 'application/json'],
        ]),
        cookies: new Map([
          ['csrf-token', { value: 'new-token', options: { httpOnly: true } }],
          [
            'csrf-token-server',
            { value: 'signed-token', options: { httpOnly: true, path: '/' } },
          ],
        ]),
      };

      // Apply the response
      const result = adapter.applyResponse(mockResponse, csrfResponse);

      // Verify headers were set
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'x-csrf-token',
        'new-token'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'content-type',
        'application/json'
      );

      // Verify cookies were set with correct options
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'csrf-token',
        'new-token',
        { httpOnly: true }
      );
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'csrf-token-server',
        'signed-token',
        { httpOnly: true, path: '/' }
      );

      // Verify the response was returned
      expect(result).toBe(mockResponse);
    });

    it('should apply headers and cookies from objects correctly', () => {
      // Create mock NextResponse
      const mockResponse = {
        headers: {
          set: vi.fn(),
        },
        cookies: {
          set: vi.fn(),
        },
      } as unknown as NextResponse;

      // Create mock CsrfResponse with object headers and cookies
      const csrfResponse: CsrfResponse = {
        headers: {
          'x-csrf-token': 'new-token',
          'content-type': 'application/json',
        },
        cookies: {
          'csrf-token': { value: 'new-token', options: { httpOnly: true } },
          'csrf-token-server': {
            value: 'signed-token',
            options: { httpOnly: true, path: '/' },
          },
        },
      };

      // Apply the response
      const result = adapter.applyResponse(mockResponse, csrfResponse);

      // Verify headers were set
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'x-csrf-token',
        'new-token'
      );
      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'content-type',
        'application/json'
      );

      // Verify cookies were set with correct options
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'csrf-token',
        'new-token',
        { httpOnly: true }
      );
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'csrf-token-server',
        'signed-token',
        { httpOnly: true, path: '/' }
      );

      // Verify the response was returned
      expect(result).toBe(mockResponse);
    });
  });

  describe('getTokenFromRequest', () => {
    it('should extract token from header', async () => {
      // Create mock request with token in header
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers({
          'x-csrf-token': 'header-token',
        }),
        cookies: new Map(),
        body: {},
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
      } as RequiredCsrfConfig;

      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBe('header-token');
    });

    it('should extract token from cookie', async () => {
      // Define the token header name to be used consistently
      const tokenHeaderName = 'x-csrf-token';

      // Create the config for token extraction
      const config = {
        token: {
          headerName: tokenHeaderName,
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig;

      // Create mock cookies object with both get and getAll methods
      // The get method needs to use the lowercase version of the cookie name
      // as that's what the adapter implementation uses
      const mockCookies = {
        get: vi.fn((name) => {
          if (name === config.cookie.name.toLowerCase()) {
            return { value: 'cookie-token' };
          }
          return undefined;
        }),
        getAll: vi
          .fn()
          .mockReturnValue([
            { name: tokenHeaderName.toLowerCase(), value: 'cookie-token' },
          ]),
      };

      // Create a NextRequest with the mocked cookies
      const mockNextRequest = new NextRequest('http://localhost/api', {
        method: 'POST',
      });

      // Mock the cookies property on the NextRequest
      Object.defineProperty(mockNextRequest, 'cookies', {
        value: mockCookies,
        configurable: true,
      });

      // Create a mock NextRequest that will be placed in request.body
      const mockNextRequestForCookie = {
        cookies: mockCookies,
        text: vi.fn(),
        json: vi.fn(),
        formData: vi.fn(),
      };

      // Skip the adapter.extractRequest and directly create a mock CsrfRequest
      // This avoids any issues with the extraction process
      const csrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers(),
        cookies: new Map<string, string>(),
        body: mockNextRequestForCookie, // Put the NextRequest mock in body
      };

      // Test the token extraction
      const token = await adapter.getTokenFromRequest(
        csrfRequest as unknown as CsrfRequest,
        config
      );
      expect(token).toBe('cookie-token');
    });

    it('should extract token from multipart form data', async () => {
      // Create mock FormData with proper entries method that returns an iterator
      const mockFormData = {
        entries: vi.fn().mockReturnValue([
          ['csrf', 'form-token'],
          ['other-field', 'other-value'],
        ][Symbol.iterator]()),
      };
      // Make it an instance of FormData for instanceof check
      Object.setPrototypeOf(mockFormData, FormData.prototype);

      // Create mock Body with formData method
      const mockBody = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      };

      // Create headers with content-type
      const headers = new Headers();
      headers.set('content-type', 'multipart/form-data');

      // Create the request object
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: headers,
        cookies: new Map<string, string>(),
        body: mockBody,
      };

      // Create the config for token extraction
      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig;

      // Test the token extraction
      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBe('form-token');
    });

    it('should extract token from JSON body', async () => {
      // Create mock NextRequest with json method
      const mockNextRequest = {
        json: vi.fn().mockResolvedValue({
          csrf: 'body-token',
        }),
        text: vi.fn(),
        formData: vi.fn(),
        cookies: {
          get: vi.fn(),
        },
      };

      // Create mock request with token in body
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers({
          'content-type': 'application/json',
        }),
        cookies: new Map(),
        body: mockNextRequest,
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig;

      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBe('body-token');
    });

    it('should return undefined when no token is found', async () => {
      // Create mock NextRequest with no token
      const mockNextRequest = {
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}),
        formData: vi.fn().mockResolvedValue(new FormData()),
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
      };

      // Create mock request with no token
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers(),
        cookies: new Map(),
        body: mockNextRequest,
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig;

      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBeUndefined();
    });
  });

  // Test the private adaptCookieOptions method indirectly through applyResponse
  describe('cookie options adaptation', () => {
    it('should adapt cookie options correctly through applyResponse', () => {
      // Create mock NextResponse
      const mockResponse = {
        headers: { set: vi.fn() },
        cookies: { set: vi.fn() },
      } as unknown as NextResponse;

      // Create options with all supported properties
      const cookieOptions: CookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'strict' as const,
        path: '/api',
        domain: 'example.com',
        maxAge: 3600,
      };

      // Create a response with these options
      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([
          ['test-cookie', { value: 'test-value', options: cookieOptions }],
        ]),
      };

      // Apply the response
      adapter.applyResponse(mockResponse, csrfResponse);

      // Verify the cookie was set with correct options
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'test-cookie',
        'test-value',
        expect.objectContaining({
          secure: true,
          httpOnly: true,
          sameSite: 'strict',
          path: '/api',
          domain: 'example.com',
          maxAge: 3600,
        })
      );
    });

    it('should handle undefined cookie options', () => {
      // Create mock NextResponse
      const mockResponse = {
        headers: { set: vi.fn() },
        cookies: { set: vi.fn() },
      } as unknown as NextResponse;

      // Create a response with undefined options
      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([['test-cookie', { value: 'test-value' }]]),
      };

      // Apply the response
      adapter.applyResponse(mockResponse, csrfResponse);

      // Verify the cookie was set with empty options
      expect(mockResponse.cookies.set).toHaveBeenCalledWith(
        'test-cookie',
        'test-value',
        expect.objectContaining({})
      );
    });
  });

  describe('concurrent requests', () => {
    it('should handle cookies and headers correctly for concurrent requests', async () => {
      // Create multiple mock NextResponse objects
      const responses = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        headers: { set: vi.fn() },
        cookies: { set: vi.fn() },
      })) as unknown as (NextResponse & { id: number })[];

      // Create different CSRF responses for each concurrent request
      const csrfResponses: CsrfResponse[] = responses.map((_, i) => ({
        headers: new Map([
          ['x-csrf-token', `token-${i}`],
          ['x-request-id', `req-${i}`],
        ]),
        cookies: new Map([
          ['csrf-token', { value: `csrf-${i}`, options: { httpOnly: true } }],
          ['session-id', { value: `session-${i}`, options: { secure: true, path: '/' } }],
        ]),
      }));

      // Apply responses concurrently
      const promises = responses.map((response, i) =>
        Promise.resolve(adapter.applyResponse(response, csrfResponses[i]))
      );

      const results = await Promise.all(promises);

      // Verify each response was handled correctly
      results.forEach((result, i) => {
        const response = responses[i];
        
        // Verify headers were set correctly for this specific response
        expect(response.headers.set).toHaveBeenCalledWith('x-csrf-token', `token-${i}`);
        expect(response.headers.set).toHaveBeenCalledWith('x-request-id', `req-${i}`);
        
        // Verify cookies were set correctly for this specific response
        expect(response.cookies.set).toHaveBeenCalledWith(
          'csrf-token',
          `csrf-${i}`,
          { httpOnly: true }
        );
        expect(response.cookies.set).toHaveBeenCalledWith(
          'session-id',
          `session-${i}`,
          { secure: true, path: '/' }
        );

        // Verify the correct response object was returned
        expect(result).toBe(response);
      });

      // Verify no cross-contamination between responses
      responses.forEach((response, i) => {
        // Check that this response doesn't have calls for other responses' data
        for (let j = 0; j < responses.length; j++) {
          if (i !== j) {
            expect(response.headers.set).not.toHaveBeenCalledWith('x-csrf-token', `token-${j}`);
            expect(response.headers.set).not.toHaveBeenCalledWith('x-request-id', `req-${j}`);
            expect(response.cookies.set).not.toHaveBeenCalledWith('csrf-token', `csrf-${j}`, expect.any(Object));
            expect(response.cookies.set).not.toHaveBeenCalledWith('session-id', `session-${j}`, expect.any(Object));
          }
        }
      });
    });

    it('should handle token extraction correctly for concurrent requests', async () => {
      const configs = Array.from({ length: 3 }, (_, i) => ({
        token: {
          headerName: `x-csrf-token-${i}`,
          fieldName: `csrf-${i}`,
        },
      })) as RequiredCsrfConfig[];

      // Create requests with different tokens
      const requests: CsrfRequest[] = configs.map((config, i) => ({
        method: 'POST',
        url: `http://localhost/api/${i}`,
        headers: new Headers({
          [config.token.headerName]: `header-token-${i}`,
        }),
        cookies: new Map(),
        body: {},
      }));

      // Extract tokens concurrently
      const promises = requests.map((request, i) =>
        adapter.getTokenFromRequest(request, configs[i])
      );

      const tokens = await Promise.all(promises);

      // Verify each token was extracted correctly
      tokens.forEach((token, i) => {
        expect(token).toBe(`header-token-${i}`);
      });
    });

    it('should maintain request isolation during concurrent token extraction from different sources', async () => {
      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig;

      // Create requests with tokens in different locations
      const headerRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/1',
        headers: new Headers({ 'x-csrf-token': 'header-token' }),
        cookies: new Map(),
        body: {
          text: vi.fn(),
          json: vi.fn(),
          formData: vi.fn(),
          cookies: { get: vi.fn() },
        },
      };

      const bodyRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/2',
        headers: new Headers({ 'content-type': 'application/json' }),
        cookies: new Map(),
        body: {
          json: vi.fn().mockResolvedValue({ csrf: 'body-token' }),
          text: vi.fn(),
          formData: vi.fn(),
          cookies: { get: vi.fn() },
        },
      };

      // Create mock for form data request
      const mockFormData = {
        entries: vi.fn().mockReturnValue([['csrf', 'form-token']][Symbol.iterator]()),
      };
      // Make it an instance of FormData for instanceof check
      Object.setPrototypeOf(mockFormData, FormData.prototype);
      const mockBody = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      };
      
      const formRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/3',
        headers: new Headers({ 'content-type': 'multipart/form-data' }),
        cookies: new Map(),
        body: mockBody,
      };

      // Extract tokens concurrently
      const [headerToken, bodyToken, formToken] = await Promise.all([
        adapter.getTokenFromRequest(headerRequest, config),
        adapter.getTokenFromRequest(bodyRequest, config),
        adapter.getTokenFromRequest(formRequest, config),
      ]);

      // Verify each token was extracted from the correct source
      expect(headerToken).toBe('header-token');
      expect(bodyToken).toBe('body-token');
      expect(formToken).toBe('form-token');
    });
  });
});
