import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
      },
    }),
  },
  test: {
    globals: false,
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
})
