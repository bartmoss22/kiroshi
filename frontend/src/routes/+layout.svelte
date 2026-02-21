<script lang="ts">
    import { onMount } from 'svelte';
    import { initializeGlobalAutoScrollers } from '$lib/utils/globalAutoScrollers';
    import '../app.css';
    import MatrixBackground from '$lib/components/MatrixBackground.svelte';
    import favicon from '$lib/assets/favicon.svg';

    let { children } = $props();

    onMount(() => {
        const scrollers = initializeGlobalAutoScrollers();

        return () => {
            scrollers.destroy();
        };
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<MatrixBackground />

{@render children?.()}