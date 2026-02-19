<script lang="ts">
    let {
        value = $bindable(0),
        bufferValue = 0,
        oninput = null,
        onchange = null,
        min = 0,
        max = 100,
        dotted = false,
        height = 'h-4',
        width = 'w-full',
        color = 'bg-white',
        bufferColor = 'bg-white/20',
        trackColor = 'bg-white/10',
        disabled = false,
        formatLabel = (v) => v
    }: {
        value: number;
        bufferValue?: number;
        oninput?: ((e: Event) => void) | null;
        onchange?: ((e: Event) => void) | null;
        min?: number;
        max?: number;
        dotted?: boolean;
        height?: string;
        width?: string;
        color?: string;
        bufferColor?: string;
        trackColor?: string;
        disabled?: boolean;
        formatLabel?: (value: number) => string | number;
    } = $props();

    let container: HTMLDivElement | undefined = $state();
    let isHovering = $state(false);
    let hoverPercentage = $state(0);
    let hoverValue = $state(0);

    function handleMouseMove(e: MouseEvent) {
        if (!container || disabled) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const rawPercent = Math.max(0, Math.min(1, x / rect.width));
        hoverPercentage = rawPercent * 100;
        const range = max - min;
        hoverValue = Math.round(min + rawPercent * range);
    }
</script>

<div
    bind:this={container}
    class="relative {height} {width} group select-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-white has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-transparent transition-opacity duration-200"
    class:opacity-50={disabled} 
    role="group"
    onmousemove={handleMouseMove}
    onmouseenter={() => (isHovering = true)}
    onmouseleave={() => (isHovering = false)}
>
    <div class="absolute top-0 left-0 h-full w-full {trackColor} pointer-events-none"></div>

    <div
        class="absolute top-0 left-0 h-full {bufferColor} pointer-events-none transition-all duration-300"
        style="width: {((bufferValue - min) / (max - min)) * 100}%;"
    ></div>

    <div
        class="absolute top-0 left-0 h-full {color} pointer-events-none"
        style="width: {((value - min) / (max - min)) * 100}%;"
    ></div>

    <input
        type="range"
        {min}
        {max}
        {oninput}
        {onchange}
        {disabled}
        step="1"
        bind:value
        aria-label="Progress"
        class="appearance-none absolute top-0 left-0 z-10 h-full w-full opacity-0 cursor-pointer disabled:cursor-default"
    />

    {#if dotted}
        <div class="pointer-events-none absolute top-0 left-0 h-full w-full">
            {#each Array(9) as _, i}
                <div
                    class="absolute top-0 h-full w-1 {trackColor}"
                    style="left: {(i + 1) * 10}%; transform: translateX(-50%);"
                ></div>
            {/each}
        </div>
    {/if}

    {#if isHovering && !disabled}
        <div
            class="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-white"
            style="left: {hoverPercentage}%; transform: translateX(-50%);"
        ></div>
        <div
            class="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2"
            style="left: {hoverPercentage}%;"
        >
            {formatLabel(hoverValue)}
        </div>
    {/if}
</div>

<style>
    input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
    }

    input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 0;
        height: 0;
    }

    input[type='range']::-moz-range-thumb {
        width: 0;
        height: 0;
        border: none;
    }
</style>
