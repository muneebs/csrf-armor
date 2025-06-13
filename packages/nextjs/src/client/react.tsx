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
import {type CsrfClientConfig, csrfFetch, getCsrfToken, refreshCsrfToken} from './client.js';

interface CsrfContextValue {
  csrfToken: string | null;
  updateToken: () => void;
  csrfFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
}

const CsrfContext = createContext<CsrfContextValue | null>(null);

export function CsrfProvider({
  children,
  config,
}: Readonly<{
  children: React.ReactNode;
  config?: CsrfClientConfig;
}>) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    // Refresh token on navigation
    refreshToken();

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

export function useCsrf() {
  const context = useContext(CsrfContext);

  if (!context) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }

  return context;
}
