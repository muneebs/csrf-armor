import {
  addImports,
  addPlugin,
  addServerHandler,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit';
import type { NuxtModule } from '@nuxt/schema';
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

    // Pass module options to runtime via public config
    nuxt.options.runtimeConfig['csrfArmor'] = options as CsrfConfig;
    nuxt.options.runtimeConfig.public['csrfArmor'] = {
      cookieName: options.cookie?.name ?? 'csrf-token',
      headerName: options.token?.headerName ?? 'x-csrf-token',
    };

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
