<script lang="ts">
    import Thumbnail from '$lib/components/Thumbnail.svelte';

    interface Props {
        movies?: any[];
        shows?: any[];
        loading?: boolean;
        search?: string;
    }

    let {
        movies = [],
        shows = [],
        loading = false,
        search = ''
    }: Props = $props();
</script>

{#if loading}
    <p>Loading...</p>
{:else}
    {#if movies.length}
        <p class="pb-4 font-semibold">Movies</p>
        <div class="grid grid-cols-11 gap-4">
            {#each movies as movie}
                <Thumbnail
                    name={movie.title}
                    id={movie.id}
                    type="movie"
                    thumbnailUrl={movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : ''}
                />
            {/each}
        </div>
    {/if}

    {#if shows.length}
        <p class="pb-4 font-semibold">Shows</p>
        <div class="grid grid-cols-11 gap-8">
            {#each shows as show}
                <Thumbnail
                    name={show.name}
                    id={show.id}
                    type="show"
                    thumbnailUrl={show.poster_path
                        ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
                        : ''}
                />
            {/each}
        </div>
    {/if}

    {#if !movies.length && !shows.length && search}
        <p>No results found.</p>
    {/if}
{/if}
