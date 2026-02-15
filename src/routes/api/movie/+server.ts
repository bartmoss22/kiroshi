import { getMovieDetails } from '$lib/server/tmdb';

export async function GET({ url }) {
    const id = url.searchParams.get('id') ?? '';
    const movieDetails = await getMovieDetails(id);
    return new Response(JSON.stringify(movieDetails), {
        headers: { 'content-type': 'application/json' }
    });
}