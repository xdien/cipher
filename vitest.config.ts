import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			'@core': path.resolve(__dirname, 'src/core'),
			'@app': path.resolve(__dirname, 'src/app'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			...(process.env.CI ? ['**/integration/**'] : []),
		],
		watch: true,
	},
});
