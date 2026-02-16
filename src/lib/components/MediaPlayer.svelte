<script lang="ts">
    import Slider from '$lib/components/Slider.svelte';
    import type AVPlayer from '@libmedia/avplayer';
    import { onMount, onDestroy } from 'svelte';

    let {
        streamUrl,
        controlsVisible = $bindable(true),
    }: {
        streamUrl: string,
        controlsVisible?: boolean,
    } = $props();

    let playerContainer = $state<HTMLDivElement | null>(null);
    let player = $state<AVPlayer | null>(null);
    let resizeObserver: ResizeObserver;
    let isPlaying = $state(false);
    let isFullscreen = $state(false);
    let isSpeedingUp = $state(false);
    let currentTimeSec = $state<number>(0);
    let bufferedEndSec = $state(0);
    let durationSec = $state<number>(0);
    let volumePercent = $state<number>(25);
    let previousVolumePercent = $state<number>(-1);
    let seekTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
    let isLoading = $state(true);

    let inactivityTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    let spacePressTimer: ReturnType<typeof setTimeout> | undefined = undefined;

    let indicator = $state(false);
    let indicatorText = $state('');
    let indicatorIcon = $state('');

    let subtitlesEnabled = $state(true);
    let subtitles = $state<any[]>([]);
    let subtitleOffset = $state<number>(0);
    let showSubtitleMenu = $state(false);
    let selectedSubtitleId = $state(-1);

    function handleActivity() {
        controlsVisible = true;
        document.body.style.cursor = 'default';
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            if (isPlaying && !showSubtitleMenu) {
                controlsVisible = false;
                document.body.style.cursor = 'none';
            }
        }, 5000);
    }

    function handleTimeUpdate(pts: bigint) {
        currentTimeSec = Number(pts) / 1000;
    }

    function seek(newTimeSec: number) {
        currentTimeSec = Math.max(0, Math.min(newTimeSec, durationSec));
        if (player && isFinite(durationSec)) {
            player.seek(BigInt(Math.floor(currentTimeSec * 1000)));
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            isFullscreen = true;
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
            isFullscreen = false;
        }
    }

    function handleScrub(e: Event) {
        const target = e.target as HTMLInputElement;
        const newTime = Number(target.value);
        
        currentTimeSec = newTime;

        if (!player) return;

        if (seekTimeout) return;
        seekTimeout = setTimeout(() => {
            if (player) player.seek(BigInt(Math.floor(newTime * 1000)));
            seekTimeout = undefined;
        }, 150);
    }

    function handleSeekCommit(e: Event) {
        const target = e.target as HTMLInputElement;
        const newTime = Number(target.value);
        
        if (seekTimeout) {
            clearTimeout(seekTimeout);
            seekTimeout = undefined;
        }
        
        if (player) player.seek(BigInt(Math.floor(newTime * 1000)));
    }

    function handleVolumeChange(e: Event) {
        if (isLoading) return;
        
        const target = e.target as HTMLInputElement;
        volumePercent = Number(target.value);
        if (volumePercent > 0) previousVolumePercent = -1;
    }

    function skip(timeSec: number) {
        const newTime = currentTimeSec + timeSec;
        seek(newTime);
    }

    function toggleSubtitleMenu(e: Event) {
        e.stopPropagation();
        showSubtitleMenu = !showSubtitleMenu;
    }

    function selectSubtitle(id: number) {
        if (!player) return;

        if (id === -1) {
            player.setSubtitleEnable(false);
            subtitlesEnabled = false;
            selectedSubtitleId = -1;
        } else {
            if (!subtitlesEnabled) {
                player.setSubtitleEnable(true);
                subtitlesEnabled = true;
            }
            if (selectedSubtitleId !== id) {
                player.selectSubtitle(id);
                selectedSubtitleId = id;
            }
        }
        showSubtitleMenu = false;
    }

    function togglePlay() {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    function play() {
        if (player && !isLoading) {
            player.play({ audio: true, video: true, subtitle: true }).catch((error: any) => {
                console.error('Play failed:', error);
            });
        }
    }

    function pause() {
        if (player && !isLoading) {
            player.pause().catch((error: any) => {
                console.error('Pause failed:', error);
            });
        }
    }

    function showIndicator(icon: string, text: string) {
        indicator = true;
        indicatorIcon = icon;
        indicatorText = text;
    }

    function hideIndicator() {
        indicator = false;
        indicatorIcon = '';
        indicatorText = '';
    }

    function showIndicatorBriefly(duration: number, icon: string, text: string) {
        showIndicator(icon, text);
        setTimeout(() => {
            hideIndicator();
        }, duration);
    }

    function isInteractiveTarget(target: EventTarget | null) {
        if (!(target instanceof HTMLElement)) return false;
        return (
            target.closest('input, textarea, select, option, button') !== null ||
            target.isContentEditable
        );
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!isInteractiveTarget(e.target)) {
            handleActivity();
        }
        
        if (!streamUrl || !player || isLoading || e.repeat || isInteractiveTarget(e.target)) return;

        if (e.code === 'Space') {
            e.preventDefault();
            spacePressTimer = setTimeout(() => {
                if (!player) return;
                player.setPlaybackRate(2.0);
                showIndicator('', '2x');
                isSpeedingUp = true;
            }, 200);
        } else if (e.code === 'KeyF') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            skip(5);
            showIndicatorBriefly(200, '', '+5s');
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            skip(-5);
            showIndicatorBriefly(200, '', '-5s');
        } else if (e.code === 'ArrowUp') {
            e.preventDefault();
            volumePercent = Math.min(100, volumePercent + 5);
            if (volumePercent > 0) previousVolumePercent = -1;
            showIndicatorBriefly(200, '', `${Math.round(volumePercent)}%`);
        } else if (e.code === 'ArrowDown') {
            e.preventDefault();
            volumePercent = Math.max(0, volumePercent - 5);
            if (volumePercent === 0) previousVolumePercent = -1;
            showIndicatorBriefly(200, '', `${Math.round(volumePercent)}%`);
        }
    }

    function handleKeyUp(e: KeyboardEvent) {
        if (e.code === 'Space' && !isInteractiveTarget(e.target)) {
            e.preventDefault();
            clearTimeout(spacePressTimer);

            if (isSpeedingUp) {
                if (player) player.setPlaybackRate(1.0);
                hideIndicator();
                isSpeedingUp = false;
            } else {
                if (isPlaying) showIndicatorBriefly(200, 'pause', '');
                else showIndicatorBriefly(200, 'play_arrow', '');
                togglePlay();
            }
        }
    }

    onMount(async () => {
        if (!playerContainer) return;

        // Load AVPlayer script dynamically
        type AVPlayerConstructor = new (options: any) => AVPlayer;
        const loadAVPlayer = () => new Promise<AVPlayerConstructor>((resolve, reject) => {
            if (typeof window.AVPlayer !== 'undefined') {
                resolve(window.AVPlayer);
                return;
            }
            const script = document.createElement('script');
            script.src = '/avplayer.js';
            
            script.onload = () => resolve(window.AVPlayer);
            script.onerror = reject;
            document.head.appendChild(script);
        });

        try {
            const AVPlayerClass = await loadAVPlayer();
            
            player = new AVPlayerClass({
                container: playerContainer,
                isLive: false,
                enableWebCodecs: true,
                enableHardware: true,
                enableWebGPU: true,
                enableWorker: false,
                loop: false,
            });
        } catch (error) {
            console.error('Failed to load AVPlayer:', error);
            isLoading = false;
            return;
        }

        player.on('loaded', () => {
            if (!player) return;
            console.log('Stream loaded successfully');
            isLoading = false;
            durationSec = Number(player.getDuration()) / 1000;
            player.setVolume(volumePercent / 100);
            isLoading = false;
            player?.setRenderMode(0);
            if (playerContainer) {
                resizeObserver = new ResizeObserver((entries) => {
                    const entry = entries[0];
                    if (player && entry) {
                        player.resize(entry.contentRect.width, entry.contentRect.height);
                    }
                });
                resizeObserver.observe(playerContainer);
            }
            play();
        });

        player.on('played', () => {
            isPlaying = true;
            handleActivity();
            
            // Start updating buffer progress stats
            if (statsUpdateInterval) {
                clearInterval(statsUpdateInterval);
            }
            statsUpdateInterval = setInterval(updateBufferProgress, 500);

            subtitles = (player?.getStreams() || [])
                .filter(s => 
                    s.mediaType === 'Subtitle' && 
                    s.metadata?.language && 
                    s.metadata.language !== 'und' && 
                    s.metadata.language !== ''
                )
                .map(s => {
                    const { title, language } = s.metadata;
                    if (title && title.length > 30) {
                        s.metadata.displayTitle = language;
                    } else {
                        s.metadata.displayTitle = title ? `${title}, ${language}` : language;
                    }
                    return s;
                });

            if (subtitles.length > 0) {
                selectedSubtitleId = player?.getSelectedSubtitleStreamId() ?? -1;
                subtitlesEnabled = selectedSubtitleId != -1;
            } else {
                selectedSubtitleId = -1;
                subtitlesEnabled = false;
            }
        });

        player.on('time', (pts: bigint) => {
            handleTimeUpdate(pts);
        });

        // WORKAROUNDS FOR SUBTITLES RE-ENABLING
        // 1. After seeking (line 1777-1780)
        player.on('seeked', () => {
            if (!subtitlesEnabled) {
                setTimeout(() => {
                    player?.setSubtitleEnable(false);
                }, 100);
            }
        });
        // 2. After changing subtitle stream (line 3406, 3332)
        player.on('changed', () => {
            if (!subtitlesEnabled) {
                setTimeout(() => {
                    player?.setSubtitleEnable(false);
                }, 100);
            }
        });
        // 3. After playing (line 2469-2471) - subtitles start on play
        player.on('played', () => {
            if (!subtitlesEnabled) {
                setTimeout(() => {
                    player?.setSubtitleEnable(false);
                }, 100);
            }
        });
        // 4. After loading external subtitles (line 1522-1524)
        player.on('stream_update', () => {
            if (!subtitlesEnabled) {
                setTimeout(() => {
                    player?.setSubtitleEnable(false);
                }, 100);
            }
        });

        player.on('paused', () => {
            isPlaying = false;
            controlsVisible = true;
            clearTimeout(inactivityTimer);
            
            // Stop updating buffer progress when paused
            if (statsUpdateInterval) {
                clearInterval(statsUpdateInterval);
                statsUpdateInterval = undefined;
            }
        });

        player.on('ended', () => {
            isPlaying = false;
        });

        player.on('error', (error: any) => {
            console.error('AVPlayer error:', error);
        });

        await player.load(streamUrl, { 
            isLive: false,
            http: {
                headers: {},
                credentials: 'same-origin'
            }
        });

        window.addEventListener('click', () => {
            if (showSubtitleMenu) showSubtitleMenu = false;
        });
    });

    onDestroy(() => {
        // Clean up stats update interval
        if (statsUpdateInterval) {
            clearInterval(statsUpdateInterval);
            statsUpdateInterval = undefined;
        }

        if (resizeObserver) resizeObserver.disconnect();
        
        if (player) {
            // Stop any ongoing operations before destroying
            player.stop().catch(() => {}).finally(() => {
                if (!player) return;
                player.destroy();
                player = null;
            });
        }
    });

    // Update volume when changed
    $effect(() => {
        if (player && !isLoading) {
            player.setVolume(volumePercent / 100);
        }
    });

    let subtitleOffsetIndicatorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
    let statsUpdateInterval: ReturnType<typeof setInterval> | undefined = undefined;

    function updateBufferProgress() {
        if (!player || isLoading) return;
        
        try {
            const stats = player.getStats();
            
            // Calculate buffered time based on packet queue and framerate
            // Use video stats if available, fallback to audio
            let bufferedTime = 0;
            
            if (stats.videoPacketQueueLength > 0 && stats.videoEncodeFramerate > 0) {
                bufferedTime = stats.videoPacketQueueLength / stats.videoEncodeFramerate;
            } else if (stats.audioPacketQueueLength > 0 && stats.audioEncodeFramerate > 0) {
                bufferedTime = stats.audioPacketQueueLength / stats.audioEncodeFramerate;
            }
            
            // Update buffered end time
            bufferedEndSec = Math.min(currentTimeSec + bufferedTime, durationSec);
        } catch (error) {
            // Silently ignore stats errors
            console.debug('Failed to get player stats:', error);
        }
    }

    function handleSubtitleWheel(e: WheelEvent) {
        e.preventDefault();
        
        const step = 0.1;
        const delta = e.deltaY < 0 ? step : -step;
        subtitleOffset = subtitleOffset + delta;
        
        const offsetText = subtitleOffset >= 0 
            ? `+${subtitleOffset.toFixed(1)}s` 
            : `${subtitleOffset.toFixed(1)}s`;
        showIndicator('', offsetText);
        
        if (subtitleOffsetIndicatorTimeout) {
            clearTimeout(subtitleOffsetIndicatorTimeout);
        }
        subtitleOffsetIndicatorTimeout = setTimeout(() => {
            hideIndicator();
            subtitleOffsetIndicatorTimeout = undefined;
        }, 1000);
    }

    $effect(() => {
        handleActivity();
        return () => {
            clearTimeout(inactivityTimer);
            if (subtitleOffsetIndicatorTimeout) {
                clearTimeout(subtitleOffsetIndicatorTimeout);
            }
        };
    });
</script>

<style>
    #video-player :global(.ASS-box) {
        transition: transform 300ms ease-in-out;
        transform: translateY(0);
    }

    #video-player.controls-visible :global(.ASS-box) {
        transform: translateY(-120px) !important;
    }
</style>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<div class="relative flex min-h-screen flex-col">
    <div
        class="relative flex flex-grow items-center justify-center bg-black"
        onmousemove={handleActivity}
        role="application"
    >
        {#if indicator}
            <div
                class="absolute top-40 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 bg-black px-4 py-2 text-sm text-white"
            >
                {#if indicatorIcon}
                    <span class="material-symbols-sharp">
                        {indicatorIcon}
                    </span>
                {/if}
                {#if indicatorText}
                    <span>{indicatorText}</span>
                {/if}
            </div>
        {/if}

        {#if isLoading}
            <div
                class="absolute top-1/2 left-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 bg-black bg-opacity-80 px-8 py-6 text-white rounded-lg"
            >
                <div class="flex items-center gap-3">
                    <div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-white"></div>
                    <span class="text-lg">Loading video...</span>
                </div>
                <span class="text-sm text-gray-400">Waiting for stream</span>
            </div>
        {/if}

        <div
            id="video-controls"
            class="bg-opacity-50 absolute bottom-0 left-0 z-20 flex w-full transform flex-col items-center justify-center gap-4 bg-black p-8 transition-all duration-300 ease-in-out"
            class:!translate-y-full={!controlsVisible}
            class:pointer-events-none={!controlsVisible}
        >
            <Slider
                value={currentTimeSec}
                bufferValue={bufferedEndSec}
                disabled={isLoading}
                oninput={handleScrub}
                onchange={handleSeekCommit}
                max={durationSec}
                height="h-2.5"
                width="w-full"
                formatLabel={(value: number) => {
                    return new Date(value * 1000).toISOString().substring(11, 19);
                }}
            ></Slider>

            <div id="buttons" class="flex w-full items-center justify-between">
                <div class="flex-1">
                    <p class="text-md text-white">
                        {new Date(currentTimeSec * 1000).toISOString().substring(11, 19)} /{' '}
                        {durationSec > 0 ? new Date(durationSec * 1000).toISOString().substring(11, 19) : '--:--:--'}
                    </p>
                </div>

                <div class="flex items-center gap-8">
                    <button
                        onclick={() => skip(-10)}
                        disabled={isLoading}
                        class="material-symbols-sharp !text-4xl cursor-pointer disabled:cursor-default disabled:opacity-50"
                    >
                        replay_10
                    </button>

                    <button
                        onclick={togglePlay}
                        disabled={isLoading}
                        class="material-symbols-sharp !text-5xl cursor-pointer disabled:cursor-default disabled:opacity-50"
                    >
                        {isPlaying ? 'pause' : 'play_arrow'}
                    </button>

                    <button
                        onclick={() => skip(10)}
                        disabled={isLoading}
                        class="material-symbols-sharp !text-4xl cursor-pointer disabled:cursor-default disabled:opacity-50"
                    >
                        forward_10
                    </button>
                </div>

                <div class="flex flex-1 items-center justify-end gap-2">
                    {#if previousVolumePercent > -1}
                        <button
                            class="material-symbols-sharp cursor-pointer !text-3xl"
                            onclick={() => {
                                volumePercent = previousVolumePercent;
                                previousVolumePercent = -1;
                            }}
                        >
                            volume_mute
                        </button>
                    {:else}
                        <button
                            class="material-symbols-sharp cursor-pointer !text-3xl"
                            onclick={() => {
                                previousVolumePercent = volumePercent;
                                volumePercent = 0;
                            }}
                        >
                            {#if volumePercent === 0}
                                volume_mute
                            {:else if volumePercent < 50}
                                volume_down
                            {:else}
                                volume_up
                            {/if}
                        </button>
                    {/if}
                    <Slider
                        value={volumePercent}
                        oninput={handleVolumeChange}
                        height="h-3"
                        width="w-25"
                        formatLabel={(value: number) => {
                            return `${Math.round(value)}%`;
                        }}
                    ></Slider>
                    <div class="relative">
                        {#if showSubtitleMenu}
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col bg-black py-2 min-w-[8rem] max-h-[300px] overflow-y-auto z-50 border border-gray-700">
                                <button
                                    class="whitespace-nowrap px-4 py-2 text-left text-sm text-white hover:bg-white hover:text-black transition-colors"
                                    class:font-bold={selectedSubtitleId === -1}
                                    onclick={(e) => { e.stopPropagation(); selectSubtitle(-1); }}
                                >
                                    Off
                                </button>
                                {#each subtitles as sub}
                                    <button
                                        class="whitespace-nowrap px-4 py-2 text-left text-sm text-white hover:bg-white hover:text-black transition-colors"
                                        class:font-bold={selectedSubtitleId === sub.id}
                                        onclick={(e) => { e.stopPropagation(); selectSubtitle(sub.id); }}
                                    >
                                        {sub.metadata?.displayTitle ?? `Track ${sub.index}`}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                        <button
                            class="material-symbols-sharp cursor-pointer !text-3xl"
                            class:text-gray-500={!(subtitles.length > 0 && selectedSubtitleId != -1)}
                            class:cursor-pointer={subtitles.length > 0}
                            aria-label="Subtitles"
                            onclick={toggleSubtitleMenu}
                        >
                            {subtitles.length > 0 ? 'closed_caption' : 'closed_caption_disabled'}
                        </button>
                    </div>
                    <button
                        class="material-symbols-sharp cursor-pointer !text-3xl"
                        aria-label="Fullscreen"
                        onclick={() => {
                            toggleFullscreen();
                        }}
                    >
                        {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    </button>
                </div>
            </div>
        </div>

        <!-- AVPlayer Container -->
        <div
            id="video-player"
            class="absolute top-0 left-0 h-full w-full bg-black"
            class:controls-visible={controlsVisible}
            bind:this={playerContainer}
            onclick={togglePlay}
            ondblclick={toggleFullscreen}
            onkeydown={(e) => e.key === 'Enter' && togglePlay()}
            role="button"
            tabindex="0"
            aria-label="Video player"
        >
        </div>
    </div>
</div>
