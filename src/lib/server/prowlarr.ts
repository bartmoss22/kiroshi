import { config } from '$lib/server/config';

export interface ProwlarrResult {
    title: string;
    guid: string;
    link: string;
    pubDate: string;
    category: string;
    size: number;
    seeders: number;
    leechers: number;
    resolution: number;
    indexerId: number;
    indexerName?: string;
}

const CLEAN_REGEX_YEAR = /\b\d{4}\b/g;
const CLEAN_REGEX_COUNTRY = /\b(us|uk|au|ca)\b/g;
const CLEAN_REGEX_NON_ALPHANUM = /[^a-z0-9]/g;

const TV_REGEX = /^(?<title>.+?)[._\s](?:[([(?<year>\d{4})[)\]]?[._\s])?[sS](?<season>\d{1,2})[eE](?<episode>\d{1,2})/;
const SEASON_PACK_REGEX = /^(?<title>.+?)[._\s](?:[([(?<year>\d{4})[)\]]?[._\s])?[sS](?<season>\d{1,2})(?![eE]\d)/;
const MOVIE_REGEX = /^(?<title>.+?)[._\s][(\[]?(?<year>\d{4})[)\]]?/;

function cleanTitle(t: string): string {
    return t.toLowerCase()
        .replace(CLEAN_REGEX_YEAR, '')
        .replace(CLEAN_REGEX_COUNTRY, '')
        .replace(CLEAN_REGEX_NON_ALPHANUM, '');
}

function deduplicateResults(results: ProwlarrResult[]): ProwlarrResult[] {
    const seen = new Set<string>();
    return results.filter(item => {
        const uniqueKey = `${item.title}-${item.seeders}`;
        
        if (seen.has(uniqueKey)) return false;
        
        seen.add(uniqueKey);
        return true;
    });
}

function parseResolution(title: string): number {
    const match = title.match(/\b(\d{3,4}p|4k|8k|uhd)\b/i);
    if (!match) return 0;

    const res = match[0].toLowerCase();
    if (res === '4k' || res === 'uhd') return 2160;
    if (res === '8k') return 4320;
    return parseInt(res.replace('p', ''), 10) || 0;
}

async function fetchProwlarr(params: Record<string, string>, timeoutMs = 8000): Promise<any[]> {
    const url = new URL(`${config.prowlarrBaseUrl.replace(/\/$/, '')}/api/v1/search`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url.toString(), {
            headers: { 'X-Api-Key': config.prowlarrApiKey },
            signal: controller.signal
        });
        clearTimeout(id);
        if (!res.ok) return [];
        return await res.json();
    } catch {
        clearTimeout(id);
        return [];
    }
}

function mapToResult(item: any): ProwlarrResult {
    return {
        title: item.title,
        guid: item.guid,
        link: item.downloadUrl || item.magnetUrl || item.infoUrl,
        pubDate: item.publishDate,
        category: item.categories ? item.categories.map((c: any) => c.name).join(',') : 'Unknown',
        size: item.size,
        resolution: parseResolution(item.title),
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        indexerId: item.indexerId,
        indexerName: item.indexer
    };
}

export async function getProwlarrMovie(imdbId: string, title: string, year: string) {
    const targetCleanTitle = cleanTitle(title);

    const [idData, textData] = await Promise.all([
        fetchProwlarr({
            type: 'movie',
            query: `{ImdbId:${imdbId}}`
        }),
        fetchProwlarr({
            type: 'movie',
            query: `${title} ${year}`
        })
    ]);

    const idResults = idData.map(mapToResult);

    const textResults = textData.map(mapToResult).filter(item => {
        const match = item.title.match(MOVIE_REGEX);
        if (!match || !match.groups) return false;
        const { title: foundTitle, year: foundYear } = match.groups;

        if (foundYear && foundYear !== year) return false;
        return targetCleanTitle === cleanTitle(foundTitle);
    });

    return deduplicateResults([...idResults, ...textResults]);
}

export async function getProwlarrEpisode(imdbId: string, title: string, season: number, episode: number) {
    const targetCleanTitle = cleanTitle(title);
    const sStr = season.toString().padStart(2, '0');
    const eStr = episode.toString().padStart(2, '0');

    const [idData, textData] = await Promise.all([
        fetchProwlarr({
            type: 'tvsearch',
            query: `{ImdbId:${imdbId}}{Season:${season}}{Episode:${episode}}`
        }),
        fetchProwlarr({
            type: 'tvsearch',
            query: `${title} S${sStr}E${eStr}`
        })
    ]);

    const idResults = idData.map(mapToResult);

    const textResults = textData.map(mapToResult).filter(item => {
        const match = item.title.match(TV_REGEX);
        if (!match || !match.groups) return false;

        const { title: foundTitle, season: foundSeason, episode: foundEp } = match.groups;

        if (parseInt(foundSeason) !== season || parseInt(foundEp) !== episode) return false;
        return targetCleanTitle === cleanTitle(foundTitle);
    });

    return deduplicateResults([...idResults, ...textResults]);
}

export async function getProwlarrSeason(imdbId: string, title: string, season: number) {
    const targetCleanTitle = cleanTitle(title);
    const sStr = season.toString().padStart(2, '0');

    const [idData, textData] = await Promise.all([
        fetchProwlarr({
            type: 'tvsearch',
            query: `{ImdbId:${imdbId}}{Season:${season}}`
        }),
        fetchProwlarr({
            type: 'tvsearch',
            query: `${title} S${sStr}`
        })
    ]);

    const idResults = idData.map(mapToResult);

    const textResults = textData.map(mapToResult).filter(item => {
        const match = item.title.match(SEASON_PACK_REGEX);
        if (!match || !match.groups) return false;

        const { title: foundTitle, season: foundSeason } = match.groups;

        if (parseInt(foundSeason) !== season) return false;
        return targetCleanTitle === cleanTitle(foundTitle);
    });

    return deduplicateResults([...idResults, ...textResults]);
}