<script lang="ts">
    import SourceSelector, { type SourceItem } from '$lib/components/SourceSelector.svelte';
    import MediaPlayer from '$lib/components/MediaPlayer.svelte';
    import type { MediaInfo } from '$lib/types';
    import Header from '$lib/components/Header.svelte';

    let { mediaInfo }: { mediaInfo: MediaInfo } = $props();

    let viewState = $state<'indexing' | 'selecting' | 'preparing' | 'playing' | 'error'>(
        'indexing'
    );

    let streamUrl = $state('');
    let errorMessage = $state('');
    let sourceItems = $state<SourceItem[]>([]);
    let sourceSelectorScrollPosition = $state(0);
    let headerVisible = $state(true);

    async function fetchSources() {
        try {
            const params = new URLSearchParams();
            const title = mediaInfo.mediaType === 'movie' ? mediaInfo.title : mediaInfo.showName;
            params.append('type', mediaInfo.mediaType);
            params.append('imdbId', mediaInfo.imdbId);
            params.append('title', title);
            params.append('year', new Date(mediaInfo.releaseDate).getFullYear().toString()); 
            if (mediaInfo.mediaType === 'episode') {
                params.append('season', mediaInfo.season.toString());
                params.append('episode', mediaInfo.episode.toString());
            }

            const indexerResponse = await fetch(`/api/indexer?${params.toString()}`);
            if (!indexerResponse.ok) throw new Error('Could not find media in indexer.');

            const indexerResult = await indexerResponse.json();
            let filtered = indexerResult;

            const processed: SourceItem[] = filtered.map((item: any) => {
                let sourceItem: SourceItem = {
                    displayName: item.title || item.fileName,
                    resolution: item.resolution,
                    seeders: item.seeders,
                    sourceUrl: item.link,
                    fileName: item.fileName,
                    imdbId: item.imdbId || mediaInfo.imdbId
                };
                return sourceItem;
            });

            processed.sort((a, b) => {
                if (a.resolution !== b.resolution) {
                    return b.resolution - a.resolution;
                }
                return (b.seeders || 0) - (a.seeders || 0);
            });
            sourceItems = processed.map((item) => item);
            
            if (sourceItems.length === 0) {
                throw new Error('No streamable source could be found.');
            }

            viewState = 'selecting';
        } catch (err: any) {
            errorMessage = err.message;
            viewState = 'error';
        }
    }

    async function selectSource(sourceItem: SourceItem) {
        viewState = 'preparing';
        errorMessage = '';

        try {
            const sourceUrl = sourceItem.sourceUrl;
            const season = mediaInfo.mediaType === 'episode' ? mediaInfo.season : undefined;
            const episode = mediaInfo.mediaType === 'episode' ? mediaInfo.episode : undefined;
            const streamResponse = await fetch('/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceUrl, season, episode })
            });

            if (!streamResponse.ok) {
                const err = await streamResponse.json();
                throw new Error(err.message || 'Failed to prepare the stream.');
            }

            streamUrl = await streamResponse.json();
            streamUrl = new URL(streamUrl, window.location.origin).href;
            viewState = 'playing';
        } catch (err: any) {
            errorMessage = err.message;
            viewState = 'selecting';
        }
    }

    $effect(() => {
        fetchSources();
    });
</script>

<svelte:head>
    <style>
        html,
        body {
            overflow: hidden !important;
        }
    </style>
</svelte:head>

<div class="relative flex min-h-screen flex-col">
    <Header visible={headerVisible}>
        {#snippet middle()}
            {#if mediaInfo.mediaType === 'movie'}
                <h2 class="text-center text-xl font-bold text-white">{mediaInfo.title}</h2>
                <h3 class="text-center text-gray-400">
                    {new Date(mediaInfo.releaseDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    })}
                </h3>
            {:else if mediaInfo.mediaType === 'episode'}
                <a href={`/shows/${mediaInfo.tmdbId}`} class="cursor-pointer hover:underline">
                    <h2 class="text-center text-xl font-bold text-white">{mediaInfo.showName}: {mediaInfo.episodeName}</h2>
                    <h3 class="text-center text-gray-400">
                        {new Date(mediaInfo.releaseDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </h3>
                </a>
            {/if}
        {/snippet}
    </Header>
    {#if viewState !== 'playing'}
        <div class="flex min-h-screen items-center justify-center bg-black">
            <div
                class="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 grayscale"
                style={`background-image: url(https://image.tmdb.org/t/p/original${mediaInfo.backdropPath})`}
            ></div>
            {#if viewState === 'error'}
                <div class="relative z-10 max-w-md border border-red-600 bg-black p-8">
                    <p class="mb-4 text-center font-bold text-red-500 uppercase">Error</p>
                    <p class="text-center text-white">{errorMessage}</p>
                    <button
                        onclick={() => window.location.reload()}
                        class="mt-6 w-full cursor-pointer border border-white py-2 text-sm uppercase hover:bg-white hover:text-black"
                        >Reload</button
                    >
                </div>
            {:else if viewState === 'indexing'}
                <p
                    class="relative z-10 animate-pulse text-center tracking-widest text-white uppercase"
                >
                    Indexing...
                </p>
            {:else if viewState === 'preparing'}
                <div class="relative z-10 flex flex-col items-center gap-4">
                    <p class="animate-pulse text-center tracking-widest text-white uppercase">
                        Preparing stream...
                    </p>
                </div>
            {:else if viewState === 'selecting'}
                <div class="relative z-10 w-full max-w-6xl px-10">
                    <SourceSelector
                        {sourceItems}
                        onSelect={selectSource}
                        scrollPosition={sourceSelectorScrollPosition}
                        onScrollChange={(pos) => (sourceSelectorScrollPosition = pos)}
                    />
                </div>
            {/if}
        </div>
    {:else if streamUrl}
        <MediaPlayer
            {streamUrl}
            bind:controlsVisible={headerVisible}
        />
    {/if}
</div>
