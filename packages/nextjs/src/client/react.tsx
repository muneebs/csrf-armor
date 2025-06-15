'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type CsrfClientConfig,
  csrfFetch,
  getCsrfToken,
  refreshCsrfToken,
} from './client.js';

/**
 * Type definition for the CSRF context value provided by CsrfProvider.
 *
 * @public
 */
interface CsrfContextValue {
  /** Current CSRF token value, null if not available */
  csrfToken: string | null;
  /** Function to manually refresh the token from storage */
  updateToken: () => void;
  /** Enhanced fetch function with automatic CSRF token handling */
  csrfFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
}

const CsrfContext = createContext<CsrfContextValue | null>(null);

/**
 * Provides a React context for centralized CSRF token management in client-side applications.
 *
 * Wraps child components with CSRF state, automatic token refresh on route changes and browser navigation, and an enhanced fetch function that transparently handles CSRF protection.
 *
 * @param children - React nodes that will have access to the CSRF context.
 * @param config - Optional configuration for CSRF client behavior, including initial token and header/cookie names.
 *
 * @example
 * ```tsx
 * <CsrfProvider config={{ cookieName: 'csrf-token', headerName: 'x-csrf-token' }}>
 *   <App />
 * </CsrfProvider>
 * ```
 *
 * @example
 * ```tsx
 * const { csrfToken, csrfFetch } = useCsrf();
 * // Use csrfToken in forms and csrfFetch for protected requests
 * ```
 */
export function CsrfProvider({
  children,
  config,
}: Readonly<{
  children: React.ReactNode;
  config?: CsrfClientConfig;
}>) {
  const [csrfToken, setCsrfToken] = useState<string | null>(
    config?.initialToken ?? null
  );
  const pathname = usePathname();

  const updateToken = useCallback(() => {
    const newToken = getCsrfToken(config);
    setCsrfToken((prev) => (prev !== newToken ? newToken : prev));
  }, [config]);

  const refreshToken = useCallback(async () => {
    setTimeout(async () => {
      const newToken = await refreshCsrfToken(config);
      setCsrfToken((prev) => (prev !== newToken ? newToken : prev));
    }, 50);
  }, [config]);

  useEffect(() => {
    updateToken();
  }, [updateToken]);

  // Refresh the CSRF token when the route changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need the pathname to trigger a token update
  useEffect(() => {
    updateToken();

    // Also refresh when user navigates back (popstate event)
    const handlePopState = () => {
      refreshToken();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname]);

  // Enhanced fetch that automatically updates token from response headers
  const secureFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await csrfFetch(input, init, config);

      // Check if server sent a new token
      const headerName = config?.headerName ?? 'x-csrf-token';
      const newToken = response.headers.get(headerName);

      if (newToken && newToken !== csrfToken) {
        setCsrfToken(newToken);
      }

      return response;
    },
    [config, csrfToken]
  );

  const value = useMemo<CsrfContextValue>(
    () => ({
      csrfToken,
      updateToken,
      csrfFetch: secureFetch,
    }),
    [csrfToken, updateToken, secureFetch]
  );

  return <CsrfContext.Provider value={value}>{children}</CsrfContext.Provider>;
}

/**
 * React hook to access the current CSRF token and related utilities from the nearest {@link CsrfProvider}.
 *
 * Returns the CSRF context value, including the current token, a function to manually refresh the token, and an enhanced fetch function that automatically handles CSRF headers.
 *
 * @returns The CSRF context value with `csrfToken`, `updateToken`, and `csrfFetch`.
 * @throws {Error} If called outside of a {@link CsrfProvider}.
 *
 * @example
 * const { csrfToken, csrfFetch, updateToken } = useCsrf();
 *
 * @example
 * // Using with forms:
 * const { csrfToken } = useCsrf();
 * <input type="hidden" name="csrf_token" value={csrfToken} />
 */
export function useCsrf(): CsrfContextValue {
  const context = useContext(CsrfContext);

  if (!context) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }

  return context;
}
