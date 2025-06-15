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
 * Attempts to read the token from a cookie (default `'csrf-token'`), falling back to a `<meta name="csrf-token">` tag if the cookie is not found.
 *
 * @param config - Optional configuration to specify the cookie name.
 * @returns The CSRF token string, or `null` if not found or not running in a browser environment.
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
 * Generates an HTTP headers object containing the CSRF token.
 *
 * Retrieves the current CSRF token and returns an object with the appropriate header for use in HTTP requests. If no token is available, returns an empty object.
 *
 * @param config - Optional configuration for customizing cookie and header names.
 * @returns An object with the CSRF token header, or an empty object if no token is found.
 */
export function createCsrfHeaders(config?: CsrfClientConfig): HeadersInit {
  const token = getCsrfToken(config);
  if (!token) return {};

  const headerName = config?.headerName ?? 'x-csrf-token';
  return { [headerName]: token };
}

/**
 * Performs a fetch request with CSRF token headers automatically included.
 *
 * Merges CSRF headers with any existing headers and sends the request using the standard fetch API.
 *
 * @param input - The resource to fetch, specified as a URL or Request object.
 * @param init - Optional fetch initialization options.
 * @param config - Optional CSRF configuration to customize token retrieval and header names.
 * @returns A promise that resolves to the fetch Response.
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
 * Refreshes the CSRF token by sending a lightweight request to the server.
 *
 * Attempts to obtain a new CSRF token by making a HEAD request to the configured refresh endpoint. Returns the refreshed token from the response headers if available, or falls back to reading the token from cookies. If the refresh request fails, returns the current token if present.
 *
 * @param config - Optional configuration for cookie name, header name, initial token, and refresh endpoint.
 * @returns A promise that resolves to the refreshed CSRF token string, or null if unavailable.
 *
 * @example
 * // Refresh the CSRF token using default settings
 * const token = await refreshCsrfToken();
 *
 * // Refresh with a custom endpoint and header name
 * const token = await refreshCsrfToken({
 *   refreshEndpoint: '/api/csrf/refresh',
 *   headerName: 'X-Custom-CSRF'
 * });
 *
 * @remark Returns null if called outside a browser environment.
 */
export async function refreshCsrfToken(
  config?: CsrfClientConfig
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Make a lightweight request to refresh the token
    const response = await csrfFetch(
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
