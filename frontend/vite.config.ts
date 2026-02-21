import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { copyAVPlayer } from './vite-plugin-copy-avplayer';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), copyAVPlayer()],
	server: {
		watch: {
			ignored: ['**/cache/**', '**/TODO.txt']
		},
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'credentialless'
		},
		proxy: {
			'/api': 'http://localhost:8080'
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			}
		]
	}
});