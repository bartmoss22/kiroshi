import { getProwlarrMovie, getProwlarrSeason, getProwlarrEpisode } from '$lib/server/prowlarr';

export async function GET({ url }) {
    const type = url.searchParams.get('type');
    const imdbId = url.searchParams.get('imdbId')?.replace('tt', '');
    const title = url.searchParams.get('title');
    const year = url.searchParams.get('year');
    const season = Number(url.searchParams.get('season') ?? undefined);
    const episode = Number(url.searchParams.get('episode') ?? undefined);

    if (!type || !imdbId) {
        return new Response('Missing required parameters', { status: 400 });
    }

    if (type !== 'movie' && type !== 'episode') {
        return new Response('Invalid type parameter', { status: 400 });
    }

    if (!title) {
        return new Response('Missing title parameter', { status: 400 });
    }

    if (type === 'movie' && !year) {
        return new Response('Missing year parameter for movie type', { status: 400 });
    }

    if (type === 'episode' && (isNaN(season) || isNaN(episode))) {
        return new Response('Missing or invalid season/episode parameters for episode type', { status: 400 });
    }

    let result;
    if (type === 'episode') {
        const [seasonResults, episodeResults] = await Promise.all([
            getProwlarrSeason(imdbId, title, season),
            getProwlarrEpisode(imdbId, title, season, episode)
        ]);
        result = [...seasonResults, ...episodeResults];
    }
    else if (type === 'movie') {
        result = await getProwlarrMovie(imdbId, title, year!);
    }
    
    return new Response(JSON.stringify(result), {
        headers: { 'content-type': 'application/json' }
    });
}