<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        middle,
        visible = true,
    } : {
        middle?: Snippet,
        visible: boolean,
    }
    = $props();
</script>

<header
    class="fixed top-0 z-10 flex w-full flex-shrink-0 items-center justify-between bg-black px-10 py-8 transition-all duration-300 ease-in-out"
    class:!-translate-y-full={!visible}
    class:!opacity-0={!visible}
    class:pointer-events-none={!visible}
>
    <a href="/" class="text-lg hover:underline"><h1><b>kiroshi</b> media server</h1></a>
    <div
        class="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 transform flex-col items-center"
    >
        {#if middle}
            {@render middle()}
        {/if}
    </div>
    <button class="text-lg">account</button>
</header>
