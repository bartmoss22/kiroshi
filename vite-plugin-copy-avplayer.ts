import { type Plugin } from 'vite';
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export function copyAVPlayer(): Plugin {
	let copied = false;

	async function copyFiles() {
		if (copied) return;

		const staticDir = join(process.cwd(), 'static');
		const sourceDir = join(process.cwd(), 'node_modules/@libmedia/avplayer/dist/umd');

		// Create static directory if it doesn't exist
		if (!existsSync(staticDir)) {
			await mkdir(staticDir, { recursive: true });
		}

		// Copy all JS files from UMD build
		const files = ['avplayer.js'];
		
		// Also copy chunk files (numbered files)
		for (let i = 0; i < 1000; i++) {
			const chunkFile = `${i}.avplayer.js`;
			const sourcePath = join(sourceDir, chunkFile);
			if (existsSync(sourcePath)) {
				files.push(chunkFile);
			}
		}

		console.log(`[AVPlayer] Copying ${files.length} files to static/...`);
		
		for (const file of files) {
			const source = join(sourceDir, file);
			const dest = join(staticDir, file);
			
			if (existsSync(source)) {
				await copyFile(source, dest);
			}
		}

		console.log('[AVPlayer] Copy complete');
		copied = true;
	}

	return {
		name: 'copy-avplayer',
		buildStart: async () => {
			await copyFiles();
		},
		configureServer: async () => {
			await copyFiles();
		}
	};
}
