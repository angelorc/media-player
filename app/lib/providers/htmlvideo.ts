import type { IProvider, PlayerContext } from '../types';

export class NativeVideoProvider implements IProvider {
  private context: PlayerContext;
  private container: HTMLElement;
  private videoElement: HTMLVideoElement | null = null;
  
  // A map of bound event handlers to easily add/remove them
  private eventHandlers: { [key: string]: (event: Event) => void } = {};

  constructor(context: PlayerContext, container: HTMLElement) {
    this.context = context;
    this.container = container;
  }

  canPlay(source: string): boolean {
    // A simple check for common video file extensions.
    // In a real-world scenario, this could be more robust.
    const fileExtension = source.split('.').pop()?.toLowerCase() ?? '';
    return ['mp4', 'webm', 'ogv'].includes(fileExtension);
  }

  load(source: string): void {
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.style.width = '100%';
      this.videoElement.style.height = '100%';
      this.videoElement.playsInline = true; // Essential for iOS
      this.container.appendChild(this.videoElement);
      this.attachEvents();
    }
    this.videoElement.src = source;
  }

  destroy(): void {
    if (this.videoElement) {
      this.removeEvents();
      this.videoElement.remove();
      this.videoElement = null;
    }
  }

  play = () => this.videoElement?.play();
  pause = () => this.videoElement?.pause();
  seek = (time: number) => this.videoElement && (this.videoElement.currentTime = time);
  setVolume = (volume: number) => this.videoElement && (this.videoElement.volume = volume);
  setMuted = (muted: boolean) => this.videoElement && (this.videoElement.muted = muted);
  setPlaybackRate = (rate: number) => this.videoElement && (this.videoElement.playbackRate = rate);

  private attachEvents(): void {
    if (!this.videoElement) return;

    const { actions } = this.context.store.getState();
    const el = this.videoElement;

    // Define handlers
    this.eventHandlers = {
      loadedmetadata: () => actions.media.setDuration(el.duration),
      canplay: () => actions.media.setIsReady(true),
      play: () => actions.playback.setIsPlaying(true),
      playing: () => {
        actions.playback.setIsPlaying(true);
        actions.playback.setIsBuffering(false);
      },
      pause: () => actions.playback.setIsPlaying(false),
      ended: () => actions.playback.setIsEnded(true),
      timeupdate: () => {
        actions.playback.setCurrentTime(el.currentTime);
        if (el.buffered.length > 0) {
          actions.playback.setBuffered(el.buffered.end(el.buffered.length - 1));
        }
      },
      waiting: () => actions.playback.setIsBuffering(true),
      volumechange: () => {
        actions.properties.setVolume(el.volume);
        actions.playback.setIsMuted(el.muted);
      },
    };

    // Attach them
    for (const [event, handler] of Object.entries(this.eventHandlers)) {
      this.videoElement.addEventListener(event, handler);
    }
  }

  private removeEvents(): void {
    if (!this.videoElement) return;

    for (const [event, handler] of Object.entries(this.eventHandlers)) {
        this.videoElement.removeEventListener(event, handler);
    }
    this.eventHandlers = {};
  }
}
