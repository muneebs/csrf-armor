import { type CsrfConfig, createCsrfProtection } from '@csrf-armor/core';
import type { H3Event } from 'h3';
// @ts-expect-error - Nuxt auto-imports resolved at build time
import { defineEventHandler, useRuntimeConfig } from '#imports';
import { NuxtAdapter } from './adapter';
import { getCsrfSessionResolver } from './session';

/**
 * Lazily-initialized CSRF protection singleton.
 *
 * Created on first request and cached for the process lifetime.
 * Changes to `runtimeConfig.csrfArmor` require a full server restart.
 */
let csrfProtection: ReturnType<
  typeof createCsrfProtection<H3Event, H3Event>
> | null = null;

type RuntimeCsrfConfig = CsrfConfig & { sessionBinding?: boolean };

/**
 * Builds the core config, adding session binding when a resolver has been
 * registered with `defineCsrfSessionResolver`.
 *
 * Throws when `sessionBinding: true` is configured but no resolver exists, so
 * a missing Nitro plugin fails closed instead of silently leaving tokens
 * unbound.
 */
function resolveConfig(
  config: RuntimeCsrfConfig | undefined
): CsrfConfig | undefined {
  const { sessionBinding, ...csrfConfig } = config ?? {};
  const resolver = getCsrfSessionResolver();

  if (!resolver) {
    if (sessionBinding) {
      throw new Error(
        'CSRF Armor: sessionBinding is enabled but no session resolver is registered. ' +
          'Call defineCsrfSessionResolver() from a Nitro plugin.'
      );
    }
    return config ? csrfConfig : undefined;
  }

  return {
    ...csrfConfig,
    getSessionId: (_request, frameworkRequest) =>
      resolver(frameworkRequest as H3Event),
  };
}

/**
 * Nitro server middleware that enforces CSRF protection on all requests.
 *
 * Reads configuration from `runtimeConfig.csrfArmor` (set by the Nuxt module).
 * On success, stores the generated token on `event.context.csrfToken`.
 * On failure, throws a 403 error with the validation reason.
 */
export default defineEventHandler(async (event: H3Event) => {
  if (!csrfProtection) {
    const config = useRuntimeConfig().csrfArmor as
      | RuntimeCsrfConfig
      | undefined;
    const adapter = new NuxtAdapter();
    csrfProtection = createCsrfProtection<H3Event, H3Event>(
      adapter,
      resolveConfig(config)
    );
  }

  const result = await csrfProtection.protect(event, event);

  if (!result.success) {
    throw Object.assign(new Error('CSRF validation failed'), {
      statusCode: 403,
      statusMessage: 'CSRF validation failed',
      data: { reason: result.reason },
    });
  }

  if (result.token) {
    // biome-ignore lint/complexity/useLiteralKeys: H3EventContext uses index signatures
    event.context['csrfToken'] = result.token;
  }
});
