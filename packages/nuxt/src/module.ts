import {
  addImports,
  addPlugin,
  addServerHandler,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
import { defu } from 'defu';
import type { CsrfConfig } from '@csrf-armor/core';

// Re-export core types for consumer convenience
export type {
  CookieOptions,
  CsrfConfig,
  CsrfProtectResult,
  CsrfStrategy,
  TokenOptions,
  ValidationResult,
} from '@csrf-armor/core';

export {
  generateNonce,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
} from '@csrf-armor/core';

export interface ModuleOptions extends CsrfConfig {}

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
    const mergedConfig = defu(
      nuxt.options.runtimeConfig.csrfArmor as Partial<CsrfConfig> | undefined,
      options
    ) as CsrfConfig;

    nuxt.options.runtimeConfig.csrfArmor = mergedConfig;
    nuxt.options.runtimeConfig.public.csrfArmor = defu(
      nuxt.options.runtimeConfig.public.csrfArmor as
        | { cookieName?: string; headerName?: string }
        | undefined,
      {
        cookieName: mergedConfig.cookie?.name ?? 'csrf-token',
        headerName: mergedConfig.token?.headerName ?? 'x-csrf-token',
      }
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
