<script lang="ts">
    import type { PageData } from './$types';
    import MediaView from '$lib/components/MediaView.svelte';

    let { data }: { data: PageData } = $props();
</script>

<MediaView mediaInfo={data.movieInfo} />