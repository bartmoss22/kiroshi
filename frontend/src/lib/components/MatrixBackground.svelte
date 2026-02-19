<!-- Credit: https://codepen.io/wefiy/pen/WPpEwo -->
<script lang="ts">
    import { onMount } from 'svelte';

    let canvas: HTMLCanvasElement | undefined = $state();

    onMount(() => {
        if (!canvas) return;
        
        const c = canvas;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        function resizeCanvas() {
            c.width = window.innerWidth;
            c.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const matrixChars =
            'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}';
        const matrix: string[] = matrixChars.split('');
        const font_size = 15;
        let columns: number;
        let drops: number[];

        function initDrops() {
            columns = Math.floor(c.width / font_size);
            drops = [];
            for (let x = 0; x < columns; x++) drops[x] = 1;
        }
        initDrops();

        function draw() {
            if (!ctx) return;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, c.width, c.height);

            ctx.fillStyle = '#222222';
            ctx.font = `${font_size}px "Geist Mono", monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = matrix[Math.floor(Math.random() * matrix.length)];
                ctx.fillText(text, i * font_size, drops[i] * font_size);

                if (drops[i] * font_size > c.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        }

        const interval = setInterval(draw, 100);

        window.addEventListener('resize', () => {
            resizeCanvas();
            initDrops();
        });

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', resizeCanvas);
        };
    });
</script>

<canvas bind:this={canvas} class="matrix-bg"></canvas>

<style>
    .matrix-bg {
        position: fixed;
        inset: 0;
        z-index: -1;
        width: 100vw;
        height: 100vh;
        display: block;
        pointer-events: none;
    }
</style>
