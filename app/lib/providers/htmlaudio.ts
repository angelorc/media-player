import type { IProvider, PlayerContext } from '../types';

export class NativeAudioProvider implements IProvider {
  private context: PlayerContext;
  private container: HTMLElement;
  private audioElement: HTMLAudioElement | null = null;
  private eventHandlers: { [key: string]: (event: Event) => void } = {};

  constructor(context: PlayerContext, container: HTMLElement) {
    this.context = context;
    this.container = container; // We still get the container, but won't render anything visible.
  }

  canPlay(source: string): boolean {
    const fileExtension = source.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    return ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileExtension);
  }

  load(source: string): void {
    if (!this.audioElement) {
      this.audioElement = document.createElement('audio');
      // No need to append to container, it's invisible.
      this.attachEvents();
    }
    this.audioElement.src = source;
  }

  destroy(): void {
    if (this.audioElement) {
      this.removeEvents();
      this.audioElement = null; // Garbage collection will handle the rest.
    }
  }

  play = () => this.audioElement?.play();
  pause = () => this.audioElement?.pause();
  seek = (time: number) => this.audioElement && (this.audioElement.currentTime = time);
  setVolume = (volume: number) => this.audioElement && (this.audioElement.volume = volume);
  setMuted = (muted: boolean) => this.audioElement && (this.audioElement.muted = muted);
  setPlaybackRate = (rate: number) => this.audioElement && (this.audioElement.playbackRate = rate);

  private attachEvents(): void {
    if (!this.audioElement) return;

    const { actions } = this.context.store.getState();
    const el = this.audioElement;

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
      this.audioElement.addEventListener(event, handler);
    }
  }

  private removeEvents(): void {
    if (!this.audioElement) return;

    for (const [event, handler] of Object.entries(this.eventHandlers)) {
        this.audioElement.removeEventListener(event, handler);
    }
    this.eventHandlers = {};
  }
}