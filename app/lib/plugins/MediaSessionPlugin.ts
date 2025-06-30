import type { MediaPlayerPublicApi, PlayerPlugin, PlayerState, Subscription } from '../types';

export class MediaSessionPlugin implements PlayerPlugin {
  public readonly name = 'MediaSessionPlugin';
  public readonly type = 'feature';

  private player: MediaPlayerPublicApi | null = null;
  private subscription: Subscription | null = null;
  private lastSyncedTrackId: string | null = null;

  public onRegister(player: MediaPlayerPublicApi): void {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) {
      console.log('MediaSessionPlugin: Media Session API not supported.');
      return;
    }

    this.player = player;

    this.subscription = this.player.subscribe(this.syncState.bind(this));

    try {
      navigator.mediaSession.setActionHandler('play', () => { this.player?.play().catch(e => console.warn("MediaSession: play() action failed.", e)); });
      navigator.mediaSession.setActionHandler('pause', () => this.player?.pause());
      navigator.mediaSession.setActionHandler('stop', () => { this.player?.stop().catch(e => console.warn("MediaSession: stop() action failed.", e)); });
    } catch (error) {
      console.warn('MediaSessionPlugin: Could not set base media session action handlers.', error);
    }
  }

  public destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.player = null;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('seekto', null);
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState();
      }
    }
  }

  private syncState(state: PlayerState): void {
    if (!this.player || !('mediaSession' in navigator) || !window.MediaMetadata) {
      return;
    }

    this._syncMetadata(state);
    this._syncPlaybackState(state);
    this._syncPositionState(state);
    this._syncActionHandlers(state);
  }

  private createArtworkUrls(artwork: string): { src: string; sizes: string; type: string }[] {
    const sizes = [96, 128, 192, 256, 384, 512, 720, 1024];
    return sizes.map(size => ({
      src: `https://ipx.bitsong.io/f_jpg,w_${size},h_${size}/${artwork}`,
      sizes: `${size}x${size}`,
      type: 'image/jpg'
    }));
  }

  private _syncMetadata(state: PlayerState): void {
    const { currentTrack } = state;

    if (currentTrack && currentTrack.id !== this.lastSyncedTrackId) {
      this.lastSyncedTrackId = currentTrack.id;
      const metadata = currentTrack.metadata || {};

      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState();
      }

      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: metadata.title || 'Untitled Track',
          artist: metadata.artist || 'Unknown Artist',
          album: 'on BitSong',
          artwork: metadata.artwork ? this.createArtworkUrls(metadata.artwork) : []
        });
      } catch (e) {
        console.warn("MediaSessionPlugin: Failed to set media session metadata.", e);
      }
    } else if (!currentTrack && this.lastSyncedTrackId !== null) {
      navigator.mediaSession.metadata = null;
      this.lastSyncedTrackId = null;
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState();
      }
    }
  }

  private _syncPlaybackState({ playbackState }: PlayerState): void {
    try {
      switch (playbackState) {
        case 'PLAYING':
          navigator.mediaSession.playbackState = 'playing';
          break;
        case 'PAUSED':
        case 'IDLE':
        case 'ENDED':
          navigator.mediaSession.playbackState = 'paused';
          break;
        default:
          navigator.mediaSession.playbackState = 'none';
          break;
      }
    } catch (e) {
      console.warn('MediaSessionPlugin: Could not set media session playbackState', e);
    }
  }

  private _syncPositionState(state: PlayerState): void {
    if (!('setPositionState' in navigator.mediaSession)) {
      return;
    }

    const { duration, currentTime, currentTrack } = state;
    const hasValidDuration = duration > 0 && isFinite(duration);

    if (currentTrack && hasValidDuration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: Math.min(currentTime, duration),
        });
      } catch (e) {
        console.warn("MediaSessionPlugin: Could not set media session position state:", e);
      }
    }
  }

  private _syncActionHandlers(state: PlayerState): void {
    const { queue, currentIndex, duration } = state;
    const hasValidDuration = duration > 0 && isFinite(duration);

    try {
      const canNext = currentIndex >= 0 && currentIndex < queue.length - 1;
      navigator.mediaSession.setActionHandler('nexttrack', canNext ? () => this.player?.next() : null);

      const canPrevious = currentIndex > 0;
      navigator.mediaSession.setActionHandler('previoustrack', canPrevious ? () => this.player?.previous() : null);

      navigator.mediaSession.setActionHandler('seekbackward', hasValidDuration ? (details) => {
        const seekOffset = details.seekOffset || 10;
        if (this.player) this.player.seek(this.player.getState().currentTime - seekOffset);
      } : null);

      navigator.mediaSession.setActionHandler('seekforward', hasValidDuration ? (details) => {
        const seekOffset = details.seekOffset || 10;
        if (this.player) this.player.seek(this.player.getState().currentTime + seekOffset);
      } : null);

      navigator.mediaSession.setActionHandler('seekto', hasValidDuration ? (details) => {
        if (this.player && details.seekTime !== null && details.seekTime !== undefined && !details.fastSeek) {
          this.player.seek(details.seekTime);
        }
      } : null);

    } catch (error) {
      console.warn('MediaSessionPlugin: Could not set dynamic media session action handlers.', error);
    }
  }
}
