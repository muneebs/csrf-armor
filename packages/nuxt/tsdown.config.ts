import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/module.ts',
    'src/runtime/utils/client.ts',
    'src/runtime/server/adapter.ts',
    'src/runtime/server/middleware.ts',
    'src/runtime/composables/useCsrfToken.ts',
    'src/runtime/composables/useCsrfFetch.ts',
    'src/runtime/plugin.client.ts',
  ],
  format: ['esm'],
  unbundle: true,
  platform: 'neutral',
  tsconfig: './tsconfig.json',
  external: [
    '#app',
    '#imports',
    'nuxt/app',
    'vue',
    'h3',
    '@nuxt/kit',
    '@nuxt/schema',
    '@csrf-armor/core',
    'defu',
  ],
})
