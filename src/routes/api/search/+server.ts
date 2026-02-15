import { searchMovies } from '$lib/server/tmdb';
import { searchShows } from '$lib/server/tmdb';

export async function GET({ url }) {
    const query = url.searchParams.get('q') ?? '';
    const movieResults = await searchMovies(query);
    const showResults = await searchShows(query);
    const results = {
        movies: movieResults.results ?? [],
        shows: showResults.results ?? []
    };
    return new Response(JSON.stringify(results), {
        headers: { 'content-type': 'application/json' }
    });
}