import { watch } from 'vue';
// @ts-expect-error - Nuxt auto-imports resolved at build time
import { useRoute, useRuntimeConfig, useState } from '#imports';
import {
  type CsrfClientConfig,
  getCsrfToken,
  csrfFetch as clientCsrfFetch,
  refreshCsrfToken,
} from '../utils/client';

/** Tracks whether the global listeners have been set up (client-only). */
let globalListenersInitialized = false;

/** Cached config resolved from runtimeConfig (client-only). */
let resolvedConfig: CsrfClientConfig | null = null;

/**
 * Sets up app-level route watcher and popstate listener.
 * These are registered once and live for the entire SPA session,
 * independent of any component lifecycle.
 */
function initGlobalListeners(
  config: CsrfClientConfig,
  csrfToken: ReturnType<typeof useState<string | null>>
): void {
  if (globalListenersInitialized || !import.meta.client) return;
  globalListenersInitialized = true;

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

  window.addEventListener('popstate', () => {
    setTimeout(async () => {
      const newToken = await refreshCsrfToken(config);
      if (newToken && newToken !== csrfToken.value) {
        csrfToken.value = newToken;
      }
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
    | {
        cookieName?: string;
        headerName?: string;
      }
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

    const headerName = config.headerName ?? 'x-csrf-token';
    const newToken = response.headers.get(headerName);

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
