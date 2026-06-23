import type { CsrfConfig } from '@csrf-armor/core';
import {
  addImports,
  addPlugin,
  addServerHandler,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';

// Re-export core types for consumer convenience
export type {
  ContentTypeOptions,
  CookieOptions,
  CsrfConfig,
  CsrfLogger,
  CsrfMetrics,
  CsrfProtectResult,
  CsrfStrategy,
  GetSessionId,
  OnFailureContext,
  TokenOptions,
  ValidationResult,
} from '@csrf-armor/core';

export {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
} from '@csrf-armor/core';

export interface ModuleOptions extends CsrfConfig {
  /**
   * Name of the session cookie to read the session ID from.
   *
   * This is a Nuxt-specific shorthand because `getSessionId` (a function) cannot
   * be serialized into `runtimeConfig`. The adapter will read this cookie's
   * value and use it as the session ID for session-bound tokens.
   */
  sessionCookieName?: string;
  /**
   * Maximum request body size in bytes the Nuxt adapter will read when parsing
   * body for token extraction (default: 1MB).
   */
  maxBodySize?: number;
}

/**
 * Deep merges `overrides` into `defaults`, with `overrides` taking priority.
 * Only plain objects are merged recursively; arrays and primitives are replaced.
 */
function mergeDefaults<T>(defaults: T, overrides?: Partial<T> | null): T {
  if (!overrides) return { ...(defaults as object) } as T;
  const result = { ...(defaults as object) } as Record<string, unknown>;
  const src = overrides as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    const val = src[key];
    if (val === undefined || val === null) continue;
    const existing = result[key];
    if (
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof existing === 'object' &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      result[key] = mergeDefaults(existing, val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@csrf-armor/nuxt',
    configKey: 'csrfArmor',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {},
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    // Merge module options with any existing runtimeConfig (host app values take priority)
    const mergedConfig = mergeDefaults(
      options,
      // biome-ignore lint/complexity/useLiteralKeys: runtimeConfig uses index signatures
      nuxt.options.runtimeConfig['csrfArmor'] as
        | Partial<ModuleOptions>
        | undefined
    );

    // biome-ignore lint/complexity/useLiteralKeys: runtimeConfig uses index signatures
    nuxt.options.runtimeConfig['csrfArmor'] = mergedConfig;

    // biome-ignore lint/complexity/useLiteralKeys: runtimeConfig uses index signatures
    nuxt.options.runtimeConfig.public['csrfArmor'] = mergeDefaults(
      {
        // biome-ignore lint/complexity/useLiteralKeys: CsrfConfig uses index signatures
        cookieName: mergedConfig['cookie']?.name ?? 'csrf-token',
        // biome-ignore lint/complexity/useLiteralKeys: CsrfConfig uses index signatures
        headerName: mergedConfig['token']?.headerName ?? 'x-csrf-token',
      },
      // biome-ignore lint/complexity/useLiteralKeys: runtimeConfig uses index signatures
      nuxt.options.runtimeConfig.public['csrfArmor'] as
        | { cookieName?: string; headerName?: string }
        | undefined
    );

    // Register server middleware for CSRF protection
    addServerHandler({
      handler: resolver.resolve('./runtime/server/middleware'),
      middleware: true,
    });

    // Register composables for auto-import
    addImports([
      {
        name: 'useCsrfToken',
        as: 'useCsrfToken',
        from: resolver.resolve('./runtime/composables/useCsrfToken'),
      },
      {
        name: 'useCsrfFetch',
        as: 'useCsrfFetch',
        from: resolver.resolve('./runtime/composables/useCsrfFetch'),
      },
    ]);

    // Register a client plugin for CSRF token initialization
    addPlugin(resolver.resolve('./runtime/plugin.client'));
  },
});

export default module;
