import { verifySignedToken, createCsrfProtection } from '@csrf-armor/core';
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { createCsrfMiddleware } from '../src';
import { NextjsAdapter } from '../src/adapter.js';

describe('CSRF Middleware', () => {
  it('should allow GET requests without validation', async () => {
    const csrfProtect = createCsrfMiddleware();
    const request = new NextRequest('http://localhost/api');
    const response = NextResponse.next();

    const result = await csrfProtect(request, response);

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.response.headers.get('x-csrf-token')).toBeDefined();
  });

  it('should validate POST requests', async () => {
    // Create a test middleware with direct access to the adapter
    const adapter = new NextjsAdapter();
    vi.spyOn(adapter, 'extractRequest').mockImplementation((req) => {
      // Create a properly structured CsrfRequest with origin header
      return {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([
          ['origin', 'http://localhost']
        ]),
        cookies: new Map(),
        body: req.body
      };
    });
    
    // Create middleware with our mocked adapter
    const csrfProtection = createCsrfProtection(adapter, {
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost'],
    });
    
    const request = new NextRequest('http://localhost/api', {
      method: 'POST',
    });
    const response = NextResponse.next();
    
    const result = await csrfProtection.protect(request, response);
    
    expect(result.success).toBe(true);
  });

  it('should exclude configured paths', async () => {
    const csrfProtect = createCsrfMiddleware({
      excludePaths: ['/api/webhook'],
    });

    const request = new NextRequest('http://localhost/api/webhook', {
      method: 'POST',
    });
    const response = NextResponse.next();

    const result = await csrfProtect(request, response);

    expect(result.success).toBe(true);
    expect(result.response.headers.get('x-csrf-token')).toBeNull();
  });

  it('should set csrf cookie', async () => {
    const csrfProtect = createCsrfMiddleware({
      cookie: { name: 'test-csrf' },
    });

    const request = new NextRequest('http://localhost/');
    const response = NextResponse.next();

    const result = await csrfProtect(request, response);

    expect(result.response.cookies.get('test-csrf')).toBeDefined();
  });

  it('should generate unsigned tokens for double-submit strategy', async () => {
    const csrfProtect = createCsrfMiddleware({
      strategy: 'double-submit',
    });

    const request = new NextRequest('http://localhost/');
    const response = NextResponse.next();

    const result = await csrfProtect(request, response);

    const headerToken = result.response.headers.get('x-csrf-token');
    const cookieToken = result.response.cookies.get('csrf-token')?.value;

    expect(headerToken).toBeDefined();
    expect(cookieToken).toBeDefined();
    expect(headerToken).toBe(cookieToken);

    // Should be unsigned (no dots indicating signature)
    expect(headerToken?.includes('.')).toBe(false);
  });

  // UPDATED TEST - Fixed behavior for signed-double-submit
  it('should generate proper tokens for signed-double-submit strategy', async () => {
    const secret = 'test-secret-32-characters-long-123';
    const csrfProtect = createCsrfMiddleware({
      strategy: 'signed-double-submit',
      secret,
    });

    const request = new NextRequest('http://localhost/');
    const response = NextResponse.next();

    const result = await csrfProtect(request, response);

    const headerToken = result.response.headers.get('x-csrf-token');
    const clientCookieToken = result.response.cookies.get('csrf-token')?.value;
    const serverCookieToken =
      result.response.cookies.get('csrf-token-server')?.value;

    expect(headerToken).toBeDefined();
    expect(clientCookieToken).toBeDefined();
    expect(serverCookieToken).toBeDefined();

    // Header token and client cookie should both be unsigned and identical
    expect(headerToken?.includes('.')).toBe(false);
    expect(clientCookieToken?.includes('.')).toBe(false);
    expect(headerToken).toBe(clientCookieToken);

    // Server cookie should be signed (has one dot for signature)
    expect(serverCookieToken?.split('.').length).toBe(2);

    // Verify that the signed server cookie contains the unsigned client token
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const verifiedToken = await verifySignedToken(serverCookieToken!, secret);
    expect(verifiedToken).toBe(headerToken);
  });

  // UPDATED TEST - Client now submits unsigned token
  it('should validate signed-double-submit POST request', async () => {
    const secret = 'test-secret-32-characters-long-123';
    const csrfProtect = createCsrfMiddleware({
      strategy: 'signed-double-submit',
      secret,
    });

    // First, get tokens from a GET request
    const getRequest = new NextRequest('http://localhost/');
    const getResponse = NextResponse.next();
    const getResult = await csrfProtect(getRequest, getResponse);

    const headerToken = getResult.response.headers.get('x-csrf-token');
    const clientCookieToken =
      getResult.response.cookies.get('csrf-token')?.value;
    const serverCookieToken =
      getResult.response.cookies.get('csrf-token-server')?.value;

    // Ensure we got the expected tokens
    expect(headerToken).toBe(clientCookieToken); // Both should be unsigned and identical

    // Now make a POST request with the unsigned token (what client would submit)
    const postRequest = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: {
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        'x-csrf-token': headerToken!, // Client submits unsigned token
        'Content-Type': 'application/json',
      },
    });

    // Mock both cookies on the request
    vi.spyOn(postRequest.cookies, 'getAll').mockReturnValue([
      {
        name: 'csrf-token',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: clientCookieToken!, // Client cookie (unsigned)
      },
      {
        name: 'csrf-token-server',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: serverCookieToken!, // Server cookie (signed)
      },
    ]);

    const postResponse = NextResponse.next();
    const postResult = await csrfProtect(postRequest, postResponse);

    expect(postResult.success).toBe(true);
  });

  // UPDATED TEST - Now tamper with server cookie instead of client cookie
  it('should reject signed-double-submit with tampered server cookie', async () => {
    const secret = 'test-secret-32-characters-long-123';
    const csrfProtect = createCsrfMiddleware({
      strategy: 'signed-double-submit',
      secret,
    });

    // Get valid tokens
    const getRequest = new NextRequest('http://localhost/');
    const getResponse = NextResponse.next();
    const getResult = await csrfProtect(getRequest, getResponse);

    const headerToken = getResult.response.headers.get('x-csrf-token');
    const clientCookieToken =
      getResult.response.cookies.get('csrf-token')?.value;

    // Make POST with valid tokens but tampered server cookie
    const postRequest = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: {
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        'x-csrf-token': headerToken!,
        'Content-Type': 'application/json',
      },
    });

    // Mock cookies with tampered server cookie
    vi.spyOn(postRequest.cookies, 'getAll').mockReturnValue([
      {
        name: 'csrf-token',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: clientCookieToken!,
      },
      {
        name: 'csrf-token-server',
        value: 'tampered.signature', // Tampered server cookie
      },
    ]);

    const postResponse = NextResponse.next();
    const postResult = await csrfProtect(postRequest, postResponse);

    expect(postResult.success).toBe(false);
    expect(postResult.reason).toContain('Invalid signature');
  });

  it('should reject signed-double-submit with wrong header token', async () => {
    const secret = 'test-secret-32-characters-long-123';
    const csrfProtect = createCsrfMiddleware({
      strategy: 'signed-double-submit',
      secret,
    });

    // Get valid tokens
    const getRequest = new NextRequest('http://localhost/');
    const getResponse = NextResponse.next();
    const getResult = await csrfProtect(getRequest, getResponse);

    const clientCookieToken =
      getResult.response.cookies.get('csrf-token')?.value;
    const serverCookieToken =
      getResult.response.cookies.get('csrf-token-server')?.value;

    // Make POST with valid cookies but wrong header token
    const postRequest = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'wrong-token',
        'Content-Type': 'application/json',
      },
    });

    vi.spyOn(postRequest.cookies, 'getAll').mockReturnValue([
      {
        name: 'csrf-token',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: clientCookieToken!,
      },
      {
        name: 'csrf-token-server',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: serverCookieToken!,
      },
    ]);

    const postResponse = NextResponse.next();
    const postResult = await csrfProtect(postRequest, postResponse);

    expect(postResult.success).toBe(false);
    expect(postResult.reason).toBe('Token mismatch');
  });

  // NEW TEST - Ensure client cookie and server cookie are in sync
  it('should reject signed-double-submit with mismatched client and server cookies', async () => {
    const secret = 'test-secret-32-characters-long-123';
    const csrfProtect = createCsrfMiddleware({
      strategy: 'signed-double-submit',
      secret,
    });

    // Get valid tokens for one request
    const getRequest1 = new NextRequest('http://localhost/');
    const getResponse1 = NextResponse.next();
    const getResult1 = await csrfProtect(getRequest1, getResponse1);

    // Get valid tokens for another request (different tokens)
    const getRequest2 = new NextRequest('http://localhost/');
    const getResponse2 = NextResponse.next();
    const getResult2 = await csrfProtect(getRequest2, getResponse2);

    const headerToken = getResult1.response.headers.get('x-csrf-token');
    const clientCookieToken =
      getResult1.response.cookies.get('csrf-token')?.value;
    const serverCookieToken =
      getResult2.response.cookies.get('csrf-token-server')?.value; // Different!

    // Make POST with mismatched cookies
    const postRequest = new NextRequest('http://localhost/api', {
      method: 'POST',
      headers: {
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        'x-csrf-token': headerToken!,
        'Content-Type': 'application/json',
      },
    });

    vi.spyOn(postRequest.cookies, 'getAll').mockReturnValue([
      {
        name: 'csrf-token',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: clientCookieToken!,
      },
      {
        name: 'csrf-token-server',
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        value: serverCookieToken!, // From different request
      },
    ]);

    const postResponse = NextResponse.next();
    const postResult = await csrfProtect(postRequest, postResponse);

    expect(postResult.success).toBe(false);
    expect(postResult.reason).toBe('Cookie integrity check failed');
  });
});
