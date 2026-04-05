/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/navigation before importing the module
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

import {
  getCsrfToken,
  createCsrfHeaders,
  csrfFetch,
  refreshCsrfToken,
} from '../src/client/client.js';

describe('Client utilities', () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });
  });

  describe('getCsrfToken', () => {
    it('should return token from cookie', () => {
      document.cookie = 'csrf-token=test-token-123';
      const token = getCsrfToken();
      expect(token).toBe('test-token-123');
    });

    it('should use custom cookie name', () => {
      document.cookie = 'my-csrf=custom-token';
      const token = getCsrfToken({ cookieName: 'my-csrf' });
      expect(token).toBe('custom-token');
    });

    it('should decode URI-encoded cookie value', () => {
      document.cookie = 'csrf-token=token%20with%20spaces';
      const token = getCsrfToken();
      expect(token).toBe('token with spaces');
    });

    it('should return raw value if decodeURIComponent fails', () => {
      // Set a cookie with a value that would fail decoding
      // Use Object.defineProperty to simulate invalid encoding
      const originalCookie = Object.getOwnPropertyDescriptor(
        Document.prototype,
        'cookie'
      );
      Object.defineProperty(document, 'cookie', {
        get: () => 'csrf-token=%E0%A4%A',
        set: () => {},
        configurable: true,
      });

      const token = getCsrfToken();
      expect(token).toBe('%E0%A4%A');

      // Restore
      if (originalCookie) {
        Object.defineProperty(document, 'cookie', originalCookie);
      }
    });

    it('should fall back to meta tag', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'csrf-token');
      meta.setAttribute('content', 'meta-token-456');
      document.head.appendChild(meta);

      const token = getCsrfToken();
      expect(token).toBe('meta-token-456');

      document.head.removeChild(meta);
    });

    it('should return null when no token found', () => {
      const token = getCsrfToken();
      expect(token).toBeNull();
    });

    it('should prefer cookie over meta tag', () => {
      document.cookie = 'csrf-token=cookie-token';
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'csrf-token');
      meta.setAttribute('content', 'meta-token');
      document.head.appendChild(meta);

      const token = getCsrfToken();
      expect(token).toBe('cookie-token');

      document.head.removeChild(meta);
    });
  });

  describe('createCsrfHeaders', () => {
    it('should return headers with token', () => {
      document.cookie = 'csrf-token=header-test-token';
      const headers = createCsrfHeaders();
      expect(headers).toEqual({ 'x-csrf-token': 'header-test-token' });
    });

    it('should use custom header name', () => {
      document.cookie = 'csrf-token=custom-header-token';
      const headers = createCsrfHeaders({ headerName: 'X-Custom-CSRF' });
      expect(headers).toEqual({ 'X-Custom-CSRF': 'custom-header-token' });
    });

    it('should return empty object when no token', () => {
      const headers = createCsrfHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('csrfFetch', () => {
    beforeEach(() => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('ok', { status: 200 })
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should add CSRF headers to fetch request', async () => {
      document.cookie = 'csrf-token=fetch-token';
      await csrfFetch('/api/data', { method: 'POST' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/data',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('fetch-token');
    });

    it('should merge with existing headers', async () => {
      document.cookie = 'csrf-token=merge-token';
      await csrfFetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('merge-token');
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should work without a token', async () => {
      await csrfFetch('/api/data');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/data',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );
    });
  });

  describe('refreshCsrfToken', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should make HEAD request and return token from header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, {
          headers: { 'x-csrf-token': 'refreshed-token' },
        })
      );

      const token = await refreshCsrfToken();
      expect(token).toBe('refreshed-token');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/',
        expect.objectContaining({
          method: 'HEAD',
          credentials: 'same-origin',
        })
      );
    });

    it('should use custom refresh endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, {
          headers: { 'x-csrf-token': 'token' },
        })
      );

      await refreshCsrfToken({ refreshEndpoint: '/api/csrf/refresh' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/csrf/refresh',
        expect.any(Object)
      );
    });

    it('should fall back to cookie when no header token in response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { headers: {} })
      );
      document.cookie = 'csrf-token=fallback-token';

      const token = await refreshCsrfToken();
      expect(token).toBe('fallback-token');
    });

    it('should return current token on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Network error')
      );
      document.cookie = 'csrf-token=current-token';

      const token = await refreshCsrfToken();
      expect(token).toBe('current-token');
    });

    it('should use custom header name', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, {
          headers: { 'X-Custom-CSRF': 'custom-refreshed' },
        })
      );

      const token = await refreshCsrfToken({
        headerName: 'X-Custom-CSRF',
      });
      expect(token).toBe('custom-refreshed');
    });
  });
});
