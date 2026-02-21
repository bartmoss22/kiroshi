import type { MovieInfo } from '$lib/types';
import type { PageLoad } from './$types';

type LoadOutput = {
    movieInfo: MovieInfo;
};

export const load: PageLoad<LoadOutput> = async ({ params, fetch }) => {
    const res = await fetch(`/api/movie?id=${encodeURIComponent(params.movieId)}`);
    const movieDetails = await res.json();

    const movieInfo: MovieInfo = {
        mediaType: 'movie', 
        title: movieDetails.title,
        releaseDate: movieDetails.release_date,
        tmdbId: params.movieId,
        imdbId: movieDetails.imdb_id,
        backdropPath: movieDetails.backdrop_path,
    };

    return { movieInfo };
};