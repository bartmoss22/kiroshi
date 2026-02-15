import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

const get = (key: string): string => {
    const value = env[key];
    if (value) return value;
    if (building) return 'BUILD_PLACEHOLDER';
    throw new Error(`Missing environment variable: ${key}`);
};

export const config = {
    get tmdbApiKey() { return get('TMDB_API_KEY'); },
    get prowlarrBaseUrl() { return get('PROWLARR_BASE_URL'); },
    get prowlarrApiKey() { return get('PROWLARR_API_KEY'); },
    get torrentPort() { return parseInt(get('WEBTORRENT_TORRENT_PORT')); },
    get torrentStorageLimitGB() {  return parseFloat(get('TORRENT_STORAGE_LIMIT_GB')); },
};