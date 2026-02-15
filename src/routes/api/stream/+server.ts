import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
    getStreamUrl,
    resolveSource
} from '$lib/server/stream';
import logger from '$lib/utils/logger';

export const POST: RequestHandler = async ({ request }) => {
    const { sourceUrl, season, episode } = await request.json();

    try {
        const source = await resolveSource(sourceUrl);
        const streamUrl = await getStreamUrl(source, season, episode);
        return json(streamUrl);
    } catch (e: any) {
        logger.error(`Failed to prepare stream: ${e.message}`, { label: 'api:stream' });
        throw error(500, `Stream not available: ${e.message}`);
    }
};