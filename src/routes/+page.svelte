<script lang="ts">
    import { goto } from '$app/navigation';
    import Header from '$lib/components/Header.svelte';
    import ThumbnailGrid from '$lib/components/ThumbnailGrid.svelte';

    let { data } = $props();

    let search = $derived(data.search);
    let movies = $derived(data.movies);
    let shows = $derived(data.shows);

    let loading = $state(false);
    let isInitial = $state(true);

    let debounceTimeout: ReturnType<typeof setTimeout>;

    async function onInput(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        search = value;

        goto(`/?q=${encodeURIComponent(value)}`, {
            replaceState: !isInitial,
            noScroll: true,
            keepFocus: true
        });
        isInitial = false;

        clearTimeout(debounceTimeout);
        if (value) {
            loading = true;
            debounceTimeout = setTimeout(async () => {
                const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
                const data = await res.json();
                movies = data.movies;
                shows = data.shows;
                loading = false;
            }, 300);
        } else {
            movies = [];
            shows = [];
            loading = false;
        }
    }
</script>

<div class="flex min-h-screen flex-col">
    <Header visible={true}>
        {#snippet middle()}
            <input
                type="text"
                value={search}
                oninput={onInput}
                placeholder="search..."
                class="w-full border-t-0 border-r-0 border-b border-l-0 border-white bg-black text-lg"
                autocomplete="off"
            />
        {/snippet}
    </Header>
    <div class="flex flex-grow px-10 pt-24">
        <div>
            <ThumbnailGrid {movies} {shows} {loading} {search} />
        </div>
    </div>
</div>
