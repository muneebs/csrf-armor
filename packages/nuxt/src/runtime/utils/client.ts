/**
 * Configuration options for CSRF client utilities.
 */
export interface CsrfClientConfig {
  /** Name of the cookie containing the CSRF token (default: 'csrf-token') */
  cookieName?: string;
  /** Name of the header to send the CSRF token in (default: 'x-csrf-token') */
  headerName?: string;
  /** Initial token value if available */
  initialToken?: string;
  /** Endpoint to use for token refresh (default: current pathname) */
  refreshEndpoint?: string;
}

/**
 * Retrieves the current CSRF token from cookies or meta tag fallback.
 *
 * @param config - Optional configuration for cookie name
 * @returns The CSRF token string, or null if not found
 */
export function getCsrfToken(config?: CsrfClientConfig): string | null {
  if (!import.meta.client) return null;

  const cookieName = config?.cookieName ?? 'csrf-token';

  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find((c) => c.trim().startsWith(`${cookieName}=`));

  if (csrfCookie) {
    const eqIndex = csrfCookie.indexOf('=');
    const value = eqIndex !== -1 ? csrfCookie.slice(eqIndex + 1) : '';
    return decodeURIComponent(value.trim());
  }

  // Fallback to meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag?.getAttribute('content') ?? null;
}

/**
 * Creates HTTP headers containing the CSRF token.
 *
 * @param config - Optional configuration for header and cookie names
 * @returns Headers object with CSRF token, or empty object if unavailable
 */
export function createCsrfHeaders(config?: CsrfClientConfig): HeadersInit {
  const token = getCsrfToken(config);
  if (!token) return {};

  const headerName = config?.headerName ?? 'x-csrf-token';
  return { [headerName]: token };
}

/**
 * Enhanced fetch that automatically injects the CSRF token header.
 *
 * @param input - URL or Request object
 * @param init - Optional fetch init options
 * @param config - Optional CSRF configuration
 * @returns Fetch response promise
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
 * Refreshes the CSRF token via a lightweight HEAD request.
 *
 * Falls back to reading the current cookie if the request fails.
 *
 * @param config - Optional configuration for endpoint and header names
 * @returns The refreshed token, or null if unavailable
 */
export async function refreshCsrfToken(
  config?: CsrfClientConfig
): Promise<string | null> {
  if (!import.meta.client) return null;

  try {
    const response = await fetch(
      config?.refreshEndpoint ?? window.location.pathname,
      {
        method: 'HEAD',
        credentials: 'same-origin',
      }
    );

    const headerName = config?.headerName ?? 'x-csrf-token';
    const newToken = response.headers.get(headerName);

    if (newToken) {
      return newToken;
    }

    return getCsrfToken(config);
  } catch {
    return getCsrfToken(config);
  }
}
