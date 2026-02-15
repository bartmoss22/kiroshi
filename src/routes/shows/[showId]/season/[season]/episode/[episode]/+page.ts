import type { EpisodeInfo, ShowInfo } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

type LoadOutput = {
    episodeInfo: EpisodeInfo,
};

export const load: PageLoad<LoadOutput> = async ({ params, fetch }) => {
    const [showRes, episodeRes] = await Promise.all([
        fetch(`/api/show?id=${encodeURIComponent(params.showId)}`),
        fetch(`/api/episode?id=${encodeURIComponent(params.showId)}&season=${params.season}&episode=${params.episode}`)
    ]);

    const showDetails = await showRes.json();
    const episodeDetails = await episodeRes.json();

    if (!episodeDetails || !episodeDetails.name) {
        throw error(404, {
            message: 'Requested episode does not exist.'
        });
    }

    const episodeInfo: EpisodeInfo = {
        mediaType: 'episode',
        showName: showDetails.name,
        tmdbId: params.showId,
        imdbId: showDetails.external_ids.imdb_id,
        episodeImdbId: episodeDetails.external_ids.imdb_id,
        episodeName: episodeDetails.name,
        season: Number(params.season),
        episode: Number(params.episode),
        releaseDate: episodeDetails.air_date,
        backdropPath: episodeDetails.still_path ?? showDetails.backdrop_path,
    };

    return {
        episodeInfo,
    };
};