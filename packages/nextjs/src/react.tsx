'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type CsrfClientConfig, csrfFetch, getCsrfToken } from './client.js';

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

  const updateToken = useCallback(() => {
    const newToken = getCsrfToken(config);
    setCsrfToken((prev) => (prev !== newToken ? newToken : prev));
  }, [config]);

  // Initialize token on mount
  useEffect(() => {
    updateToken();
  }, [updateToken]);

  // Event-driven updates
  useEffect(() => {
    if (!config?.autoRefresh) {
      return;
    }

    // Listen for page visibility changes (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateToken();
      }
    };

    // Listen for focus events (user switches back to window)
    const handleFocus = () => {
      updateToken();
    };

    // Listen for storage events (if using localStorage fallback)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'csrf-token') {
        updateToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [config?.autoRefresh, updateToken]);

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
