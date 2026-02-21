<script lang="ts">
    export interface SourceItem {
        displayName: string;
        resolution: number;
        seeders: number;
        guid: string;
        link: string;
        fileName: string;
        imdbId: string;
    }

    let { sourceItems, onSelect, scrollPosition = 0, onScrollChange } = $props<{
        sourceItems: SourceItem[];
        onSelect: (sourceItem: SourceItem) => void;
        scrollPosition?: number;
        onScrollChange?: (position: number) => void;
    }>();

    let scrollerElement = $state<HTMLDivElement | null>(null);

    // Restore scroll position when component is shown
    $effect(() => {
        if (scrollerElement && scrollPosition > 0) {
            // Use requestAnimationFrame to ensure DOM is fully laid out
            requestAnimationFrame(() => {
                if (scrollerElement) {
                    scrollerElement.scrollTop = scrollPosition;
                }
            });
        }
    });

    // Save scroll position when user scrolls
    function handleScroll() {
        if (scrollerElement && onScrollChange) {
            onScrollChange(scrollerElement.scrollTop);
        }
    }
</script>

<div class="flex max-h-[70vh] w-full flex-col bg-black">
    <div class="flex items-center justify-between border-b border-white/20 bg-black p-4">
        <h3 class="text-sm tracking-widest text-white uppercase">Select Source</h3>
        <span class="text-xs text-gray-500 uppercase">{sourceItems.length} results</span>
    </div>

    <div class="scroller flex-1 overflow-y-auto" bind:this={scrollerElement} onscroll={handleScroll}>
        <table class="w-full border-collapse text-left text-sm">
            <thead
                class="sticky top-0 border-b border-white/10 bg-black text-xs tracking-wider text-gray-500 uppercase"
            >
                <tr>
                    <th class="p-4 font-normal">File Name</th>
                    <th class="w-24 p-4 font-normal">Quality</th>
                    <th class="w-24 p-4 text-right font-normal">Seeds</th>
                </tr>
            </thead>
            <tbody>
                {#each sourceItems as sourceItem}
                    <tr
                        class="group cursor-pointer border-b border-white/5 transition-colors duration-75 hover:bg-white"
                        onclick={() => onSelect(sourceItem)}
                    >
                        <td class="max-w-lg truncate p-4 text-gray-300 group-hover:text-black">
                            {sourceItem.displayName}
                        </td>
                        <td class="p-4 font-bold text-gray-400 group-hover:text-black">
                            <span class="border border-current px-1 text-xs"
                                >{sourceItem.resolution > 0 ? `${sourceItem.resolution}p` : 'Unknown'}</span
                            >
                        </td>
                        <td class="p-4 text-right text-gray-400 group-hover:text-black">
                            {sourceItem.seeders}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>
