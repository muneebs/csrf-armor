'use client';

export interface CsrfClientConfig {
  cookieName?: string;
  headerName?: string;
  autoRefresh?: boolean;
}

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

export function createCsrfHeaders(config?: CsrfClientConfig): HeadersInit {
  const token = getCsrfToken(config);
  if (!token) return {};

  const headerName = config?.headerName ?? 'x-csrf-token';
  return { [headerName]: token };
}

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
