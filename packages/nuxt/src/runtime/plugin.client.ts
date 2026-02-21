import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app';
import type { CsrfArmorPublicConfig } from './types';
import { getCsrfToken } from './utils/client';

/**
 * Client-side Nuxt plugin that initializes the CSRF token state.
 *
 * Uses `useState` so the token is reactive and consistent with
 * the `useCsrfToken` composable (both share the same key).
 */
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const publicConfig = runtimeConfig.public.csrfArmor as
    | CsrfArmorPublicConfig
    | undefined;

  const token = getCsrfToken({
    cookieName: publicConfig?.cookieName ?? 'csrf-token',
  });

  // Shared with useCsrfToken() composable via the same useState key
  const csrfToken = useState<string | null>('csrf-token', () => token);
  csrfToken.value = token;

  return {
    provide: {
      csrfToken,
    },
  };
});
