import type { AVPlayer } from '@libmedia/avplayer';

interface AVPlayerConstructor {
    new (options: any): AVPlayer;
}

declare global {
    interface Window {
        AVPlayer: AVPlayerConstructor;
    }
}

export { };
