<script lang="ts">
    import MediaView from '$lib/components/MediaView.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let episodeInfo = $state(data.episodeInfo);
</script>

<MediaView mediaInfo={episodeInfo} />