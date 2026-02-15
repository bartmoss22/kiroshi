import WebTorrent from 'webtorrent';
import { config } from '$lib/server/config';
import logger from '$lib/utils/logger';
import type { Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';

export const ANNOUNCE_LIST = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.demonoid.ch:6969/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://explodie.org:6969/announce',
    'udp://tracker2.dler.org:80/announce',
    'udp://tracker.tryhackx.org:6969/announce',
    'udp://tracker.torrust-demo.com:6969/announce',
    'udp://tracker.therarbg.to:6969/announce',
    'udp://tracker.skynetcloud.site:6969/announce',
    'udp://tracker.qu.ax:6969/announce',
    'udp://tracker.hifimarket.in:2710/announce',
    'udp://tracker.gmi.gd:6969/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://tracker.bittor.pw:1337/announce',
    'udp://tracker.0x7c0.com:6969/announce',
    'udp://tracker-udp.gbitt.info:80/announce',
    'udp://tr4ck3r.duckdns.org:6969/announce',
    'udp://t.overflow.biz:6969/announce'
];

type StreamInstance = {
    client: WebTorrent.Instance;
    server: HttpServer;
    getServerPort: () => number;
};

const globalForWebtorrent = globalThis as unknown as {
    webtorrentInstance: StreamInstance | undefined;
};

export const getStreamInstance = (): StreamInstance => {
    if (globalForWebtorrent.webtorrentInstance) {
        return globalForWebtorrent.webtorrentInstance;
    }

    logger.info('Initializing WebTorrent Client...', { label: 'webtorrent' });

    const client = new WebTorrent({
        // @ts-ignore - config types might not perfectly match WebTorrent expectations
        torrentPort: config.torrentPort,
        // @ts-ignore
        natUpnp: false,
        natPmp: false,
        dht: {
            port: config.torrentPort
        },
        maxConns: 300,
    } as any);

    const server = client.createServer() as unknown as HttpServer;
    let serverPort = 0;

    server.listen(0, () => {
        const address = server.address() as AddressInfo;
        if (address) {
            serverPort = address.port;
            logger.info(`WebTorrent HTTP server running on port ${serverPort}`, { label: 'webtorrent' });
        }
    });

    client.on('error', (err) => {
        logger.error(
            `WebTorrent Client error: ${err instanceof Error ? err.message : String(err)}`,
            { label: 'webtorrent' }
        );
    });

    const cleanup = () => {
        logger.info('Closing WebTorrent HTTP server.', { label: 'webtorrent' });
        try {
            server.close();
            client.destroy();
        } catch (e) {
        }
    };
    process.on('exit', cleanup);

    const instance: StreamInstance = {
        client,
        server,
        getServerPort: () => serverPort
    };

    globalForWebtorrent.webtorrentInstance = instance;
    return instance;
};

export const getClient = () => getStreamInstance().client;

export const getServerPort = () => getStreamInstance().getServerPort();