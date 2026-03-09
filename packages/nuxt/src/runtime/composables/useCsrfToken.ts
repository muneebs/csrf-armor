import { effectScope, watch } from 'vue';
// @ts-expect-error - Nuxt auto-imports resolved at build time
import { useRoute, useRuntimeConfig, useState } from '#imports';
import {
  type CsrfClientConfig,
  getCsrfToken,
  csrfFetch as clientCsrfFetch,
  refreshCsrfToken,
} from '../utils/client';
import type { CsrfArmorPublicConfig } from '../types';

/**
 * Detached effect scope for global listeners.
 * Keeps watchers alive independent of component lifecycle.
 */
let globalScope: ReturnType<typeof effectScope> | null = null;

/**
 * Cached config resolved from runtimeConfig.
 * Set once on first composable call and reused for the process lifetime.
 * Changes to runtimeConfig require a server/app restart to take effect.
 */
let resolvedConfig: CsrfClientConfig | null = null;

/**
 * Sets up app-level route watcher and popstate listener.
 * These are registered once and live for the entire SPA session,
 * independent of any component lifecycle.
 *
 * Uses a detached effect scope so watchers survive component unmounts.
 */
function initGlobalListeners(
  config: CsrfClientConfig,
  csrfToken: ReturnType<typeof useState<string | null>>
): void {
  if (globalScope || !import.meta.client) return;

  // Create a detached scope that won't be disposed when the calling component unmounts
  globalScope = effectScope(true);

  globalScope.run(() => {
    const route = useRoute();

    watch(
      () => route.path,
      () => {
        const newToken = getCsrfToken(config);
        if (newToken !== csrfToken.value) {
          csrfToken.value = newToken;
        }
      }
    );
  });

  // On browser back/forward, wait briefly for the middleware Set-Cookie
  // header to settle before reading the updated token from cookies.
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      refreshCsrfToken(config)
        .then((newToken) => {
          if (newToken && newToken !== csrfToken.value) {
            csrfToken.value = newToken;
          }
        })
        .catch(() => {
          // Silently ignore — refreshCsrfToken falls back to cookie read internally
        });
    }, 50);
  });
}

/**
 * Composable providing reactive CSRF token management.
 *
 * Uses Nuxt's `useState` for SSR-safe, request-isolated state that is
 * shared across all component instances within the same request/session.
 *
 * Route watchers and popstate listeners are registered once at the app level
 * on the client and are independent of component lifecycle.
 *
 * @returns Reactive token ref, update function, and CSRF-enhanced fetch
 */
export function useCsrfToken() {
  const runtimeConfig = useRuntimeConfig();

  const publicConfig = runtimeConfig.public.csrfArmor as
    | CsrfArmorPublicConfig
    | undefined;

  if (!resolvedConfig) {
    resolvedConfig = {
      cookieName: publicConfig?.cookieName ?? 'csrf-token',
      headerName: publicConfig?.headerName ?? 'x-csrf-token',
    };
  }

  const config = resolvedConfig;

  // useState: request-isolated on server, shared singleton on client
  const csrfToken = useState<string | null>('csrf-token', () =>
    getCsrfToken(config)
  );

  /** Reads the current CSRF token from cookies and updates the reactive ref. */
  function updateToken(): void {
    const newToken = getCsrfToken(config);
    if (newToken !== csrfToken.value) {
      csrfToken.value = newToken;
    }
  }

  /**
   * Enhanced fetch that includes CSRF headers and updates the token
   * from response headers when the server provides a new one.
   */
  async function csrfFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await clientCsrfFetch(input, init, config);

    const newToken = response.headers.get(config.headerName ?? 'x-csrf-token');

    if (newToken && newToken !== csrfToken.value) {
      csrfToken.value = newToken;
    }

    return response;
  }

  // Initialize global listeners (no-op if already done or on server)
  initGlobalListeners(config, csrfToken);

  // Read the initial token on the client
  if (import.meta.client) {
    updateToken();
  }

  return {
    csrfToken,
    updateToken,
    csrfFetch,
  };
}
