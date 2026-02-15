<script lang="ts">
    interface Props {
        name?: string;
        id?: string;
        thumbnailUrl?: string;
        type?: string;
    }

    let {
        name = 'unknown',
        id = '',
        thumbnailUrl = '',
        type = 'movie'
    }: Props = $props();
</script>

<a href={`/${type}s/${id}`} class="group flex w-32 cursor-pointer flex-col items-center">
    <div
        class="aspect-[2/3] w-32 overflow-hidden rounded shadow-md transition-transform duration-50 group-hover:scale-110"
    >
        {#if thumbnailUrl}
            <img src={thumbnailUrl} alt={name} class="h-full w-full object-cover" />
        {:else}
            <div class="flex h-full w-full items-center justify-center bg-neutral-900 text-white text-lg text-center">
                {name}
            </div>
        {/if}
    </div>
    <span class="mt-2 text-center text-sm text-neutral-300 group-hover:text-white">{name}</span>
</a>
