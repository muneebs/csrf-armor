import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.config.ts',
				'**/*.d.ts',
				'src/types.ts',
				'src/index.ts',
			],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
});
