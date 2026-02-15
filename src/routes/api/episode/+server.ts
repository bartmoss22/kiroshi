import { getEpisodeDetails } from '$lib/server/tmdb';

export async function GET({ url }) {
    const id = url.searchParams.get('id');
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');

    if (!id || !season || !episode) {
        return new Response('Missing required parameters', { status: 400 });
    }

    const episodeDetails = await getEpisodeDetails(id, Number(season), Number(episode));
    return new Response(JSON.stringify(episodeDetails), {
        headers: { 'content-type': 'application/json' }
    });
}