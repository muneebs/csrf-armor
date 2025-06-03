import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  unbundle: true,
  platform: 'browser',
  tsconfig: './tsconfig.json',
  exports: true,
});
