<script lang="ts">
    import Header from '$lib/components/Header.svelte';
    import type { EpisodeInfo } from '$lib/types';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let showInfo = $state(data.showInfo);
    let allEpisodes = $state<EpisodeInfo[]>([]);

    $effect(() => {
        data.episodeInfosPromise
            .then((allSeasons) => {
                const fullList: EpisodeInfo[][] = [];

                allSeasons.forEach((season: any) => {
                    const sIdx = season.season_number;

                    fullList[sIdx] = [];

                    season.episodes.forEach((ep: any) => {
                        const eIdx = ep.episode_number;

                        fullList[sIdx][eIdx] = {
                            mediaType: 'episode',
                            showName: showInfo.title,
                            tmdbId: showInfo.tmdbId,
                            imdbId: showInfo.imdbId,
                            episodeName: ep.name,
                            season: sIdx,
                            episode: eIdx,
                            releaseDate: ep.air_date,
                            backdropPath: ep.still_path
                        };
                    });
                });

                showInfo.episodeInfos = fullList;
                
                // Flatten the 2D array into a single list for the grid
                const flattened: EpisodeInfo[] = [];
                fullList.forEach((season) => {
                    season.forEach((episode) => {
                        if (episode) {
                            flattened.push(episode);
                        }
                    });
                });
                allEpisodes = flattened;
            })
            .catch((err) => {
                console.error('Hydration failed', err);
            });
    });
</script>

<div class="flex min-h-screen flex-col">
    <Header visible={true}>
        {#snippet middle()}
            <h2 class="text-center text-xl font-bold text-white">{showInfo.title}</h2>
            <h3 class="text-center text-gray-400">
                {new Date(showInfo.releaseDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })}
            </h3>
        {/snippet}
    </Header>
    <div class="flex flex-grow px-10 pt-24">
        <div class="w-full">
            {#if allEpisodes.length > 0}
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {#each allEpisodes as episode}
                        <a
                            href={`/shows/${episode.tmdbId}/season/${episode.season}/episode/${episode.episode}`}
                            class="group block cursor-pointer transition-opacity hover:opacity-80"
                        >
                            <div class="aspect-video w-full overflow-hidden bg-neutral-900">
                                {#if episode.backdropPath}
                                    <img
                                        src={`https://image.tmdb.org/t/p/w500${episode.backdropPath}`}
                                        alt={episode.episodeName}
                                        class="h-full w-full object-cover"
                                    />
                                {:else}
                                    <div class="flex h-full w-full items-center justify-center text-white">
                                        S{episode.season}E{episode.episode}
                                    </div>
                                {/if}
                            </div>
                            <div class="mt-2 text-center">
                                <p class="text-sm text-white">S{episode.season} E{episode.episode}</p>
                                <p class="text-xs text-neutral-400">{episode.episodeName}</p>
                            </div>
                        </a>
                    {/each}
                </div>
            {:else}
                <p class="text-neutral-400">Loading episodes...</p>
            {/if}
        </div>
    </div>
</div>