import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts'],
  unbundle: true,
  platform: 'browser',
  tsconfig: './tsconfig.json',
});
