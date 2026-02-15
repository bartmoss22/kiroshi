import { config } from '$lib/server/config';


export async function searchMovies(query: string) {
    const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${config.tmdbApiKey}&query=${encodeURIComponent(query)}`
    );
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`TMDb error (searchMovies, query="${query}"): ${errorBody}`);
    }
    return res.json();
}

export async function searchShows(query: string) {
    const res = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${config.tmdbApiKey}&query=${encodeURIComponent(query)}`
    );
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`TMDb error (searchShows, query="${query}"): ${errorBody}`);
    }
    return res.json();
}

export async function getMovieDetails(id: string) {
    const res = await fetch(
        `https://api.themoviedb.org/3/movie/${id}?api_key=${config.tmdbApiKey}&append_to_response=credits,videos,images`
    );
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`TMDb error (getMovieDetails, id="${id}"): ${errorBody}`);
    }
    return res.json();
}

export async function getShowDetails(id: string) {
    const res = await fetch(
        `https://api.themoviedb.org/3/tv/${id}?api_key=${config.tmdbApiKey}&append_to_response=credits,videos,images,external_ids`
    );
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`TMDb error (getShowDetails, id="${id}"): ${errorBody}`);
    }
    return res.json();
}

export async function getSeasonDetails(
    id: string,
    season: number
) {
    const res = await fetch(
        `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${config.tmdbApiKey}`
    );
    
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
            `TMDb error (getEpisodeDetails, Series ID: ${id}, S${season}): ${errorBody}`
        );
    }
    
    return res.json(); 
}

export async function getEpisodeDetails(
    id: string,
    season: number,
    episode: number
) {
    const res = await fetch(
        `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${config.tmdbApiKey}&append_to_response=credits,videos,images,external_ids`
    );
    
    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
            `TMDb error (getEpisodeDetails, Series ID: ${id}, S${season}): ${errorBody}`
        );
    }
    
    return res.json(); 
}