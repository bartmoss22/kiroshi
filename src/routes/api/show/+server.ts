import { getShowDetails } from '$lib/server/tmdb';

export async function GET({ url }) {
    const id = url.searchParams.get('id') ?? '';
    const showDetails = await getShowDetails(id);
    return new Response(JSON.stringify(showDetails), {
        headers: { 'content-type': 'application/json' }
    });
}