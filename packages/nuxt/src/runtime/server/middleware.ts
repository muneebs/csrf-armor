import type { H3Event } from 'h3';
import { createError, defineEventHandler } from 'h3';
import { type CsrfConfig, createCsrfProtection } from '@csrf-armor/core';
import { NuxtAdapter } from './adapter';
// @ts-expect-error - Nuxt auto-imports resolved at build time
import { useRuntimeConfig } from '#imports';

/**
 * Lazily-initialized CSRF protection singleton.
 * Created on first request to allow runtime config resolution.
 */
let csrfProtection: ReturnType<
  typeof createCsrfProtection<H3Event, H3Event>
> | null = null;

/**
 * Nitro server middleware that enforces CSRF protection on all requests.
 *
 * Reads configuration from `runtimeConfig.csrfArmor` (set by the Nuxt module).
 * On success, stores the generated token on `event.context.csrfToken`.
 * On failure, throws a 403 error with the validation reason.
 */
export default defineEventHandler(async (event: H3Event) => {
  if (!csrfProtection) {
    const config = useRuntimeConfig().csrfArmor as CsrfConfig | undefined;
    const adapter = new NuxtAdapter();
    csrfProtection = createCsrfProtection<H3Event, H3Event>(
      adapter,
      config ?? undefined
    );
  }

  const result = await csrfProtection.protect(event, event);

  if (!result.success) {
    throw createError({
      statusCode: 403,
      statusMessage: 'CSRF validation failed',
      data: { reason: result.reason },
    });
  }

  if (result.token) {
    event.context.csrfToken = result.token;
  }
});
