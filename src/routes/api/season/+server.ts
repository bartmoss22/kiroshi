import { getSeasonDetails } from '$lib/server/tmdb';

export async function GET({ url }) {
    const id = url.searchParams.get('id');
    const season = url.searchParams.get('season');

    if (!id || !season) {
        return new Response('Missing required parameters', { status: 400 });
    }

    const showDetails = await getSeasonDetails(id, Number(season));
    return new Response(JSON.stringify(showDetails), {
        headers: { 'content-type': 'application/json' }
    });
}