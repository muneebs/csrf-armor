// @ts-expect-error - Nuxt auto-imports resolved at build time
import { useFetch, useRuntimeConfig } from '#imports';
import type { UseFetchOptions } from 'nuxt/app';
import { getCsrfToken } from '../utils/client';

/**
 * Wrapper around Nuxt's `useFetch` that automatically includes CSRF headers.
 *
 * Uses the `onRequest` interceptor to attach a fresh token per-request,
 * ensuring the header value is always current even for retried or
 * long-lived requests.
 *
 * @param url - Request URL (same as useFetch first argument)
 * @param opts - useFetch options, CSRF headers are merged into existing headers
 * @returns The useFetch return value with data, error, pending, etc.
 */
export function useCsrfFetch<T>(
  url: string | (() => string),
  opts?: UseFetchOptions<T>
) {
  const runtimeConfig = useRuntimeConfig();

  const publicConfig = runtimeConfig.public.csrfArmor as
    | {
        cookieName?: string;
        headerName?: string;
      }
    | undefined;

  const cookieName = publicConfig?.cookieName ?? 'csrf-token';
  const headerName = publicConfig?.headerName ?? 'x-csrf-token';

  return useFetch<T>(url, {
    ...opts,
    onRequest(context) {
      const token = getCsrfToken({ cookieName });
      if (token) {
        const headers = new Headers(
          context.options.headers as HeadersInit | undefined
        );
        headers.set(headerName, token);
        context.options.headers = headers;
      }

      // Chain with any existing onRequest handler
      if (typeof opts?.onRequest === 'function') {
        return (
          opts.onRequest as (ctx: typeof context) => void | Promise<void>
        )(context);
      }
    },
  } as UseFetchOptions<T>);
}
