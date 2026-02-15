import { error, type RequestHandler } from '@sveltejs/kit';
import { updateTorrentLastAccessed } from '$lib/server/stream';

function parseAndValidateTarget(raw: string): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw error(400, 'Invalid url');
    }

    // Lock this endpoint down to the local WebTorrent HTTP server.
    // This prevents SSRF to arbitrary hosts.
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLocalhost) throw error(403, 'Forbidden');

    if (url.protocol !== 'http:') throw error(403, 'Forbidden');

    return url;
}

async function proxyFile(request: Request, target: URL): Promise<Response> {
    const range = request.headers.get('range') ?? undefined;

    const maxAttempts = 6;
    const baseDelayMs = 60;
    let lastErr: unknown = null;

    // Only retry aggressively for the initial probe/first bytes.
    // Many media elements start with a HEAD or a small 0-* range request.
    const isInitialRange = !range || /^bytes=0-\d*$/i.test(range);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const upstream = await fetch(target.toString(), {
                method: request.method,
                headers: range ? { Range: range } : undefined
            });

            // If the upstream server is warming up (torrent not ready yet), it may return 5xx.
            // Retry a few times to avoid a permanent playback failure.
            if (isInitialRange && upstream.status >= 500 && attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
                continue;
            }

            // Pass through key headers required for streaming + seeking.
            const headers = new Headers();

            const passthrough = [
                'content-type',
                'content-length',
                'accept-ranges',
                'content-range',
                'etag',
                'last-modified'
            ];
            for (const h of passthrough) {
                const v = upstream.headers.get(h);
                if (v) headers.set(h, v);
            }

            // Avoid caching huge media responses by default.
            if (!headers.has('cache-control')) {
                headers.set('cache-control', 'no-store');
            }

            return new Response(upstream.body, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers
            });
        } catch (e) {
            lastErr = e;
            if (!isInitialRange || attempt >= maxAttempts) break;
            await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
        }
    }

    const msg = lastErr instanceof Error ? lastErr.message : 'Upstream fetch failed';
    throw error(502, msg);
}

export const GET: RequestHandler = async ({ url, request }) => {
    const raw = url.searchParams.get('u') ?? url.searchParams.get('url');
    if (!raw) throw error(400, 'Missing url');

    const target = parseAndValidateTarget(raw);
    
    // Extract infoHash from WebTorrent URL path (format: /INFOHASH/INDEX/filename)
    const pathParts = target.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
        const infoHash = pathParts[0];
        updateTorrentLastAccessed(infoHash);
    }
    
    return proxyFile(request, target);
};

export const HEAD: RequestHandler = async ({ url, request }) => {
    const raw = url.searchParams.get('u') ?? url.searchParams.get('url');
    if (!raw) throw error(400, 'Missing url');

    const target = parseAndValidateTarget(raw);
    
    // Extract infoHash from WebTorrent URL path (format: /INFOHASH/INDEX/filename)
    const pathParts = target.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
        const infoHash = pathParts[0];
        updateTorrentLastAccessed(infoHash);
    }
    
    return proxyFile(request, target);
};
