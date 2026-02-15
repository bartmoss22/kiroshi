import type { Handle } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import logger from '$lib/utils/logger';

const torrentsCacheDir = path.resolve('downloads');
try {
    if (fs.existsSync(torrentsCacheDir)) {
        const files = fs.readdirSync(torrentsCacheDir);
        for (const file of files) {
            fs.rmSync(path.join(torrentsCacheDir, file), { recursive: true, force: true });
        }
        logger.info(`Cleaned up files in directory: ${torrentsCacheDir}`, { label: 'hooks' });
    }
} catch (err) {
    logger.error(`Failed to delete files: ${err}`, { label: 'hooks' });
}

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
	return response;
};