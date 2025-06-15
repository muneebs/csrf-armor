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
 * React context provider for CSRF token management.
 *
 * Provides centralized CSRF token state management for React components,
 * with automatic token refresh on route changes and enhanced fetch capabilities.
 *
 * **Features:**
 * - Automatic token retrieval and state synchronization
 * - Route change detection with automatic token refresh
 * - Enhanced fetch function with built-in CSRF protection
 * - Browser history integration (back/forward navigation)
 * - Optimized re-renders with memoization
 *
 * **Best Practices:**
 * - Place near the root of your component tree
 * - Use with Next.js App Router for automatic route detection
 * - Combine with server-side CSRF middleware for complete protection
 *
 * @public
 * @param children - React components that will have access to CSRF context
 * @param config - Optional CSRF client configuration
 *
 * @example
 * ```tsx
 * // app/layout.tsx - Application-wide CSRF provider
 * import { CsrfProvider } from '@csrf-armor/nextjs/client';
 *
 * export default function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode;
 * }) {
 *   return (
 *     <html lang="en">
 *       <body>
 *         <CsrfProvider config={{
 *           cookieName: 'csrf-token',
 *           headerName: 'x-csrf-token'
 *         }}>
 *           {children}
 *         </CsrfProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // components/ProtectedForm.tsx - Using CSRF in forms
 * import { useCsrf } from '@csrf-armor/nextjs/client';
 *
 * export function ProtectedForm() {
 *   const { csrfToken, csrfFetch } = useCsrf();
 *
 *   const handleSubmit = async (formData: FormData) => {
 *     try {
 *       const response = await csrfFetch('/api/submit', {
 *         method: 'POST',
 *         body: formData
 *       });
 *
 *       if (response.ok) {
 *         console.log('Form submitted successfully');
 *       }
 *     } catch (error) {
 *       console.error('Submission failed:', error);
 *     }
 *   };
 *
 *   return (
 *     <form action={handleSubmit}>
 *       {csrfToken && (
 *         <input type="hidden" name="csrf_token" value={csrfToken} />
 *       )}
 *       <button type="submit">Submit</button>
 *     </form>
 *   );
 * }
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
 * React hook for accessing CSRF token and utilities.
 *
 * Provides access to the current CSRF token and related utilities from the
 * nearest CsrfProvider. Must be used within a component tree wrapped by CsrfProvider.
 *
 * **Return Value:**
 * - `csrfToken`: Current token string (null if not available)
 * - `updateToken`: Function to manually refresh token from storage
 * - `csrfFetch`: Enhanced fetch with automatic CSRF headers
 *
 * @public
 * @returns CSRF context value with token and utilities
 * @throws Error if used outside of CsrfProvider
 *
 * @example
 * ```tsx
 * import { useCsrf } from '@csrf-armor/nextjs/client';
 *
 * function MyComponent() {
 *   const { csrfToken, csrfFetch, updateToken } = useCsrf();
 *
 *   const handleSubmit = async (data: FormData) => {
 *     try {
 *       const response = await csrfFetch('/api/submit', {
 *         method: 'POST',
 *         body: data
 *       });
 *       console.log('Success:', await response.json());
 *     } catch (error) {
 *       console.error('Failed:', error);
 *       // Optionally refresh token and retry
 *       updateToken();
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <p>Current token: {csrfToken || 'Not available'}</p>
 *       <button onClick={() => updateToken()}>
 *         Refresh Token
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Using with forms and hidden inputs
 * function ContactForm() {
 *   const { csrfToken } = useCsrf();
 *
 *   return (
 *     <form method="post" action="/api/contact">
 *       {csrfToken && (
 *         <input type="hidden" name="csrf_token" value={csrfToken} />
 *       )}
 *       <input name="email" type="email" required />
 *       <textarea name="message" required />
 *       <button type="submit">Send Message</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Error handling with automatic retry
 * function DataUploader() {
 *   const { csrfFetch, updateToken } = useCsrf();
 *
 *   const uploadFile = async (file: File) => {
 *     const formData = new FormData();
 *     formData.append('file', file);
 *
 *     try {
 *       const response = await csrfFetch('/api/upload', {
 *         method: 'POST',
 *         body: formData
 *       });
 *
 *       if (!response.ok) {
 *         throw new Error(`HTTP ${response.status}`);
 *       }
 *
 *       return await response.json();
 *     } catch (error) {
 *       if (error.message.includes('403')) {
 *         // CSRF token might be stale, refresh and retry once
 *         updateToken();
 *         await new Promise(resolve => setTimeout(resolve, 100));
 *         return uploadFile(file); // Recursive retry
 *       }
 *       throw error;
 *     }
 *   };
 *
 *   return (
 *     <input
 *       type="file"
 *       onChange={(e) => {
 *         if (e.target.files?.[0]) {
 *           uploadFile(e.target.files[0]);
 *         }
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function useCsrf(): CsrfContextValue {
  const context = useContext(CsrfContext);

  if (!context) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }

  return context;
}
