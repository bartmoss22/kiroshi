import type { ShowInfo } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

type LoadOutput = {
    showInfo: ShowInfo,
    episodeInfosPromise: Promise<any[]>
};

export const load: PageLoad<LoadOutput> = async ({ params, fetch }) => {
    const showRes = await fetch(`/api/show?id=${encodeURIComponent(params.showId)}`);
    const showDetails = await showRes.json();

    if (!showDetails) {
        throw error(404, {
            message: 'Requested show does not exist.'
        });
    }

    const showInfo: ShowInfo = {
        title: showDetails.name,
        tmdbId: params.showId,
        imdbId: showDetails.imdb_id,
        releaseDate: showDetails.first_air_date,
        backdropPath: showDetails.backdrop_path,
        episodeInfos: [],
    };

    return {
        showInfo,
        episodeInfosPromise: (async () => {
            const promises = showDetails.seasons.map((s: any) =>
                fetch(`/api/season?id=${encodeURIComponent(params.showId)}&season=${s.season_number}`).then(r => r.json())
            );
            return await Promise.all(promises);
        })()
    };
};