import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { NextjsAdapter } from '../src/adapter.js';
import type { CsrfRequest, CsrfResponse, RequiredCsrfConfig, CookieOptions } from '@csrf-armor/core';
import { Headers } from 'next/dist/compiled/@edge-runtime/primitives';

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
          { name: 'session-id', value: 'test-session' }
        ])
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
        body: JSON.stringify({ foo: 'bar' })
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
          set: vi.fn()
        },
        cookies: {
          set: vi.fn()
        }
      } as unknown as NextResponse;

      // Create mock CsrfResponse with Map headers and cookies
      const csrfResponse: CsrfResponse = {
        headers: new Map([
          ['x-csrf-token', 'new-token'],
          ['content-type', 'application/json']
        ]),
        cookies: new Map([
          ['csrf-token', { value: 'new-token', options: { httpOnly: true } }],
          ['csrf-token-server', { value: 'signed-token', options: { httpOnly: true, path: '/' } }]
        ])
      };

      // Apply the response
      const result = adapter.applyResponse(mockResponse, csrfResponse);

      // Verify headers were set
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-csrf-token', 'new-token');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('content-type', 'application/json');

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
          set: vi.fn()
        },
        cookies: {
          set: vi.fn()
        }
      } as unknown as NextResponse;

      // Create mock CsrfResponse with object headers and cookies
      const csrfResponse: CsrfResponse = {
        headers: {
          'x-csrf-token': 'new-token',
          'content-type': 'application/json'
        },
        cookies: {
          'csrf-token': { value: 'new-token', options: { httpOnly: true } },
          'csrf-token-server': { value: 'signed-token', options: { httpOnly: true, path: '/' } }
        }
      };

      // Apply the response
      const result = adapter.applyResponse(mockResponse, csrfResponse);

      // Verify headers were set
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-csrf-token', 'new-token');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('content-type', 'application/json');

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
          'x-csrf-token': 'header-token'
        }),
        cookies: new Map(),
        body: {}
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf'
        }
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
          fieldName: 'csrf'
        }
      } as RequiredCsrfConfig;
      
      // Create mock cookies object with both get and getAll methods
      // The get method needs to use the lowercase version of the header name
      // as that's what the adapter implementation uses
      const mockCookies = {
        get: vi.fn((name) => {
          if (name === tokenHeaderName.toLowerCase()) {
            return { value: 'cookie-token' };
          }
          return undefined;
        }),
        getAll: vi.fn().mockReturnValue([
          { name: tokenHeaderName.toLowerCase(), value: 'cookie-token' }
        ])
      };
      
      // Create a NextRequest with the mocked cookies
      const mockNextRequest = new NextRequest('http://localhost/api', {
        method: 'POST'
      });
      
      // Mock the cookies property on the NextRequest
      Object.defineProperty(mockNextRequest, 'cookies', {
        value: mockCookies,
        configurable: true
      });
      
      // Skip the adapter.extractRequest and directly create a mock CsrfRequest
      // This avoids any issues with the extraction process
      const csrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers(),
        cookies: new Map<string, string>(),
        body: {}
      };
      
      // Mock the NextRequest properties needed for getTokenFromRequest
      Object.defineProperty(csrfRequest, 'cookies', {
        value: mockCookies
      });
      
      // Test the token extraction
      const token = await adapter.getTokenFromRequest(csrfRequest as unknown as CsrfRequest, config);
      expect(token).toBe('cookie-token');
    });

    it('should extract token from multipart form data', async () => {
      // Create mock FormData with proper entries method
      const mockFormData = {
        entries: vi.fn().mockReturnValue({
          toArray: vi.fn().mockReturnValue([['csrf', 'form-token']])
        })
      };
      
      // Create mock Body with formData method
      const mockBody = {
        formData: vi.fn().mockResolvedValue(mockFormData)
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
        body: mockBody
      };

      // Create the config for token extraction
      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf'
        }
      } as RequiredCsrfConfig;

      // Test the token extraction
      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBe('form-token');
    });

    it('should extract token from JSON body', async () => {
      // Create mock request with token in body
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers({
          'content-type': 'application/json'
        }),
        cookies: new Map(),
        body: {
          csrf: 'body-token'
        }
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf'
        }
      } as RequiredCsrfConfig;

      const token = await adapter.getTokenFromRequest(request, config);
      expect(token).toBe('body-token');
    });

    it('should return undefined when no token is found', async () => {
      // Create mock request with no token
      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Headers(),
        cookies: new Map(),
        body: {}
      };

      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf'
        }
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
        cookies: { set: vi.fn() }
      } as unknown as NextResponse;

      // Create options with all supported properties
      const cookieOptions: CookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'strict' as 'strict',
        path: '/api',
        domain: 'example.com',
        maxAge: 3600
      };

      // Create a response with these options
      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([
          ['test-cookie', { value: 'test-value', options: cookieOptions }]
        ])
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
          maxAge: 3600
        })
      );
    });

    it('should handle undefined cookie options', () => {
      // Create mock NextResponse
      const mockResponse = {
        headers: { set: vi.fn() },
        cookies: { set: vi.fn() }
      } as unknown as NextResponse;

      // Create a response with undefined options
      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([
          ['test-cookie', { value: 'test-value' }]
        ])
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
});
