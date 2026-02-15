import logger from '$lib/utils/logger';
import bencode from 'bencode';
import { createHash } from 'crypto';
import path from 'path';
import { ANNOUNCE_LIST, getClient, getServerPort } from '$lib/server/webtorrent';
import { config } from '$lib/server/config';
import type { Torrent, TorrentFile } from 'webtorrent';

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TORRENT_UNUSED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const RATIO_THRESHOLD = 1.0; // Remove when upload ratio reaches 1.0

const torrentLastAccessed = new Map<string, number>();

export function updateTorrentLastAccessed(infoHash: string): void {
    torrentLastAccessed.set(infoHash, Date.now());
}

setInterval(async () => {
    const freedGB = safeCleanUpTorrents();
    logger.info(`Periodic cleanup completed. Freed ${(freedGB).toFixed(2)} GB. Current storage usage: ${getCurrentStorageUsageGB().toFixed(2)} GB`, { label: 'stream' });
}, CLEANUP_INTERVAL);

function safeCleanUpTorrents(): number {
    const client = getClient();
    const now = Date.now();
    let freedGB = 0;

    for (const torrent of client.torrents) {
        const lastAccessed = torrentLastAccessed.get(torrent.infoHash) || 0;
        if (torrent.downloaded > 0 && torrent.ratio >= RATIO_THRESHOLD && now - lastAccessed > TORRENT_UNUSED_THRESHOLD) {
            logger.info(`Cleaning up torrent: ${torrent.name} (InfoHash: ${torrent.infoHash}, Ratio: ${torrent.ratio.toFixed(2)}, Last Accessed: ${new Date(lastAccessed).toISOString()})`, { label: 'stream' });
            freedGB += torrent.length / 1024 / 1024 / 1024;
            torrent.destroy({ destroyStore: true });
            torrentLastAccessed.delete(torrent.infoHash);
        }
    }

    return freedGB;
}

function forceCleanUpTorrents(gbToFree: number): boolean {
    const client = getClient();
    let freedGB = 0;

    // Sort torrents by last accessed time (oldest first)
    const sortedTorrents = client.torrents.sort((a, b) => {
        const aLast = torrentLastAccessed.get(a.infoHash) || 0;
        const bLast = torrentLastAccessed.get(b.infoHash) || 0;
        return aLast - bLast;
    });

    for (const torrent of sortedTorrents) {
        if (freedGB >= gbToFree) break;
        logger.info(`Force cleaning up torrent: ${torrent.name} (InfoHash: ${torrent.infoHash})`, { label: 'stream' });
        freedGB += torrent.length / 1024 / 1024 / 1024;
        torrent.destroy({ destroyStore: true });
        torrentLastAccessed.delete(torrent.infoHash);
    }

    return freedGB >= gbToFree;
}

function getCurrentStorageUsageGB(): number {
    const client = getClient();
    let totalBytes = 0;
    for (const torrent of client.torrents) {
        totalBytes += torrent.length;
    }
    return totalBytes / 1024 / 1024 / 1024;
}

export type Source = {
    source: string | Buffer;
    infoHash: string;
}

export async function resolveSource(sourceUrl: string): Promise<Source> {
    logger.info(`Resolving Prowlarr source link: ${sourceUrl}`, { label: 'stream' });
    const res = await fetch(sourceUrl, { method: 'GET', redirect: 'manual' });
    if (res.status === 200) {
        const arrayBuffer = await res.arrayBuffer();
        const torrentBuffer = Buffer.from(arrayBuffer);

        try {
            logger.info('Attempting to decode torrent file buffer using Bencode.', { label: 'stream' });
            const decoded = bencode.decode(torrentBuffer);
            let info = decoded.info;

            if (!info) {
                throw new Error('Decoded torrent is missing "info" dictionary.');
            }

            const infoBuffer = bencode.encode(info);
            const infoHash = createHash('sha1').update(infoBuffer).digest('hex');

            logger.info(`Resolved InfoHash from torrent file buffer: ${infoHash}`, { label: 'stream' });
            return { source: torrentBuffer, infoHash: infoHash.toLowerCase() };

        } catch (error: any) {
            logger.error(`Manual Bencode Failed: ${error.message}`);
            throw new Error(`Failed to parse torrent: ${error.message}`);
        }
    }
    else if (res.status === 301) {
        logger.info(`Source URL redirected to magnet link: ${sourceUrl}`, { label: 'stream' });
        const location = res.headers.get('location');

        if (!location || !location.startsWith('magnet:')) {
            throw new Error(`Failed to resolve magnet. Status: ${res.status}, Location: ${location}`);
        }

        const hashMatch = location.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
        if (!hashMatch || !hashMatch[1]) {
            throw new Error('Could not extract InfoHash from magnet link.');
        }
        const infoHash = hashMatch[1].toLowerCase();
        logger.info(`Resolved magnet link with InfoHash: ${infoHash}`, { label: 'stream' });
        return { source: location, infoHash };
    } else {
        throw new Error(`Failed to resolve source URL. Status: ${res.status}`);
    }
}

export async function getStreamUrl(source: Source, season?: number, episode?: number): Promise<string> {
    const file = await getOrAddTorrentFile(source.source, source.infoHash);
    if (!file) {
        throw new Error('No compatible video file found in torrent.');
    }
    logger.info(`Torrent file ready: ${file.name}`, { label: 'stream' });

    if (getServerPort() === 0) {
        throw new Error('WebTorrent HTTP server is not ready yet.');
    }

    return getFileUrl(file);
}

async function getOrAddTorrentFile(source: string | Buffer, infoHash: string, season?: number, episode?: number): Promise<TorrentFile | undefined> {
    updateTorrentLastAccessed(infoHash);
    const client = getClient();

    let torrent = await client.get(infoHash);
    if (!torrent) {
        torrent = await new Promise((resolve, reject) => {
            const torrent = getClient().add(source, {
                path: path.join(process.cwd(), 'downloads'),
                announce: ANNOUNCE_LIST
            } as any);

            const timeout = setTimeout(() => {
                logger.error(`Timeout waiting for metadata: ${infoHash}`, { label: 'stream' });
                reject(new Error('Timeout waiting for torrent metadata.'));
                torrent.destroy();
            }, 60000);

            torrent.on('ready', () => {
                clearTimeout(timeout);
                logger.info(
                    `Torrent added: ${torrent.name} (${(torrent.length / 1024 / 1024 / 1024).toFixed(2)} GB)`,
                    { label: 'stream' }
                );
                resolve(torrent);
            });

            torrent.on('error', (err) => {
                clearTimeout(timeout);
                // TODO: Retry with clean and force cleanup if the error is EONT: No space left on device.
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`Torrent error: ${msg}`, { label: 'stream' });
                torrent.destroy();
                reject(new Error(msg));
            });
        });
        if (!torrent) {
            return undefined;
        }
    }

    if (getCurrentStorageUsageGB() > config.torrentStorageLimitGB) {
        logger.warn(`Storage limit exceeded. Current usage: ${getCurrentStorageUsageGB().toFixed(2)} GB, Limit: ${config.torrentStorageLimitGB} GB. Attempting cleanup...`, { label: 'stream' });
        const freed = safeCleanUpTorrents();
        logger.info(`Freed ${freed.toFixed(2)} GB from cleanup. Current usage: ${getCurrentStorageUsageGB().toFixed(2)} GB`, { label: 'stream' });
        
        if (getCurrentStorageUsageGB() > config.torrentStorageLimitGB) {
            const neededToFree = getCurrentStorageUsageGB() - config.torrentStorageLimitGB;
            logger.warn(`Storage limit still exceeded after cleanup. Attempting force cleanup to free at least ${neededToFree.toFixed(2)} GB...`, { label: 'stream' });
            const forceFreed = forceCleanUpTorrents(neededToFree);
            if (forceFreed) {
                logger.info(`Force cleanup successful. Freed at least ${neededToFree.toFixed(2)} GB. Current usage: ${getCurrentStorageUsageGB().toFixed(2)} GB`, { label: 'stream' });
            } else {
                logger.error(`Force cleanup failed to free enough space. Current usage: ${getCurrentStorageUsageGB().toFixed(2)} GB, Limit: ${config.torrentStorageLimitGB} GB`, { label: 'stream' });
                throw new Error('Unable to free enough storage space for new torrent.');
            }
        }
    }

    return selectVideoFile(torrent, season, episode);
}

function selectVideoFile(torrent: Torrent, season?: number, episode?: number): TorrentFile | undefined {
    torrent.files.forEach(file => file.deselect());

    const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'];

    // First filter to video files
    let videoFiles = torrent.files.filter((file) =>
        videoExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );

    if (videoFiles.length === 0) {
        return undefined;
    }

    // If season and episode are provided, try to find the best matching file
    if (season && episode && videoFiles.length > 1) {
        const standardPattern = new RegExp(`[sS]0*${season}[\\s._-]*[eE]0*${episode}\\b`);
        const xPattern = new RegExp(`\\b${season}x0*${episode}\\b`);
        const matchedFiles = videoFiles.filter(file => {
            const name = file.name;
            return standardPattern.test(name) || xPattern.test(name);
        });
        if (matchedFiles.length > 0) {
            videoFiles = matchedFiles;
        } else {
            return undefined;
        }
    }

    // Select the largest video file (common heuristic for main content)
    const largest = videoFiles.reduce((largest, current) =>
        current.length > largest.length ? current : largest
    );

    largest.select();
    return largest;
}

function getFileUrl(file: TorrentFile): string {
    const port = getServerPort();
    if (port === 0) {
        throw new Error('WebTorrent HTTP server is not ready yet.');
    }

    const rawUrl = `http://127.0.0.1:${port}${file.streamURL.replace(/\\/g, '/')}`;
    // Proxy through SvelteKit to keep the media URL same-origin (better CORS + Range behavior).
    return `/api/file?u=${encodeURIComponent(rawUrl)}`;
}