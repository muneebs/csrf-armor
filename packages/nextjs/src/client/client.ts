'use client';

/**
 * Configuration options for CSRF client utilities.
 *
 * These options allow customization of how the client-side CSRF protection
 * interacts with the server, including cookie names, header names, and
 * token refresh endpoints.
 */
export interface CsrfClientConfig {
  /** Name of the cookie containing the CSRF token (default: 'csrf-token') */
  cookieName?: string;
  /** Name of the header to send the CSRF token in (default: 'x-csrf-token') */
  headerName?: string;
  /** Initial token value if available (not commonly used) */
  initialToken?: string;
  /** Endpoint to use for token refresh (default: current pathname) */
  refreshEndpoint?: string;
}

/**
 * Retrieves the current CSRF token from client-side storage.
 *
 * Attempts to find the CSRF token in the following order:
 * 1. HTTP-only cookie (primary source for most strategies)
 * 2. Meta tag fallback (for server-side rendered pages)
 *
 * The token retrieval is optimized for client-side access while maintaining
 * security through HTTP-only cookies where possible.
 *
 * @param config - Optional configuration for cookie and header names
 * @returns The CSRF token string, or null if not found or not in browser
 *
 * @example
 * ```typescript
 * // Basic usage
 * const token = getCsrfToken();
 *
 * // With custom configuration
 * const token = getCsrfToken({
 *   cookieName: 'my-csrf-cookie'
 * });
 *
 * if (token) {
 *   // Use token in requests
 *   fetch('/api/data', {
 *     headers: { 'X-CSRF-Token': token }
 *   });
 * }
 * ```
 */
export function getCsrfToken(config?: CsrfClientConfig): string | null {
  if (typeof window === 'undefined') return null;

  const cookieName = config?.cookieName ?? 'csrf-token';

  // Always read from the client-accessible cookie
  // The server ensures this contains the correct token for the strategy
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find((c) => c.trim().startsWith(`${cookieName}=`));

  if (csrfCookie) {
    const [, value] = csrfCookie.split('=');
    return decodeURIComponent(value?.trim() ?? '');
  }

  // Fallback to meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag?.getAttribute('content') ?? null;
}

/**
 * Creates HTTP headers object with CSRF token for requests.
 *
 * Convenience function that retrieves the current CSRF token and formats
 * it as headers ready to be used with fetch() or other HTTP clients.
 *
 * @param config - Optional configuration for cookie and header names
 * @returns Headers object with CSRF token, or empty object if no token
 *
 * @example
 * ```typescript
 * // Basic usage
 * const headers = createCsrfHeaders();
 * fetch('/api/data', {
 *   method: 'POST',
 *   headers
 * });
 *
 * // With custom header name
 * const headers = createCsrfHeaders({
 *   headerName: 'X-Custom-CSRF'
 * });
 *
 * // Merge with existing headers
 * const headers = {
 *   'Content-Type': 'application/json',
 *   ...createCsrfHeaders()
 * };
 * ```
 */
export function createCsrfHeaders(config?: CsrfClientConfig): HeadersInit {
  const token = getCsrfToken(config);
  if (!token) return {};

  const headerName = config?.headerName ?? 'x-csrf-token';
  return { [headerName]: token };
}

/**
 * Enhanced fetch function with automatic CSRF token injection.
 *
 * A drop-in replacement for the standard fetch() function that automatically
 * includes the CSRF token in request headers. Merges CSRF headers with any
 * existing headers in the request.
 *
 * @param input - URL or Request object for the fetch
 * @param init - Optional request initialization options
 * @param config - Optional CSRF configuration
 * @returns Promise resolving to fetch Response
 *
 * @example
 * ```typescript
 * // Basic POST request with automatic CSRF protection
 * const response = await csrfFetch('/api/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 *
 * // GET request (CSRF token included for consistency)
 * const data = await csrfFetch('/api/users').then(r => r.json());
 *
 * // With custom configuration
 * const response = await csrfFetch('/api/data', {
 *   method: 'DELETE'
 * }, {
 *   headerName: 'X-Custom-CSRF',
 *   cookieName: 'my-csrf-token'
 * });
 * ```
 */
export function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  config?: CsrfClientConfig
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const csrfHeaders = createCsrfHeaders(config);

  for (const [key, value] of Object.entries(csrfHeaders)) {
    headers.set(key, value);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Refreshes the CSRF token by making a lightweight server request.
 *
 * Sends a HEAD request to the server to trigger token refresh, then returns
 * the new token from response headers or cookies. This is useful when tokens
 * expire or when you need to ensure you have the latest token.
 *
 * The function gracefully handles failures by returning the current token
 * if the refresh request fails.
 *
 * @param config - Optional configuration for endpoints and header names
 * @returns Promise resolving to the refreshed token, or null if unavailable
 *
 * @example
 * ```typescript
 * // Basic token refresh
 * const newToken = await refreshCsrfToken();
 * if (newToken) {
 *   console.log('Token refreshed:', newToken);
 * }
 *
 * // Refresh with custom endpoint
 * const token = await refreshCsrfToken({
 *   refreshEndpoint: '/api/csrf/refresh',
 *   headerName: 'X-Custom-CSRF'
 * });
 *
 * // Use in error handling
 * try {
 *   await csrfFetch('/api/data', { method: 'POST' });
 * } catch (error) {
 *   if (error.status === 403) {
 *     await refreshCsrfToken();
 *     // Retry the request
 *   }
 * }
 * ```
 */
export async function refreshCsrfToken(
  config?: CsrfClientConfig
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Make a lightweight request to refresh the token
    // Using native fetch instead of csrfFetch to avoid sending potentially expired CSRF token
    const response = await fetch(
      config?.refreshEndpoint ?? window.location.pathname,
      {
        method: 'HEAD',
        credentials: 'same-origin',
      }
    );

    // Check if server sent a new token
    const headerName = config?.headerName ?? 'x-csrf-token';
    const newToken = response.headers.get(headerName);

    if (newToken) {
      return newToken;
    }

    // Fallback to reading from cookie
    return getCsrfToken(config);
  } catch {
    // If request fails, return current token
    return getCsrfToken(config);
  }
}
