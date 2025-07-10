import type { MediaPlayerPublicApi, PlayerPlugin, PlayerState, PlaybackState, Subscription } from '../types';

/**
 * A feature plugin that integrates the browser's Media Session API.
 * This plugin listens to the player's state and updates the media session
 * accordingly, enabling platform UI controls (like on lock screens or notifications).
 */
export class MediaSessionPlugin implements PlayerPlugin {
  public readonly name = 'MediaSessionPlugin';
  public readonly type = 'feature';

  private player: MediaPlayerPublicApi | null = null;
  private subscription: Subscription | null = null;
  private lastSyncedTrackId: string | null = null;
  private lastPlaybackState: PlaybackState = 'IDLE';

  /**
   * Called when the plugin is registered with the MediaPlayer. This is the
   * entry point for initializing the plugin and its listeners.
   * @param player - The MediaPlayer instance to integrate with.
   */
  public onRegister(player: MediaPlayerPublicApi): void {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) {
      console.log('MediaSessionPlugin: Media Session API not supported.');
      return;
    }

    this.player = player;

    // Initialize with the current state
    const initialState = this.player.getState();
    this.lastPlaybackState = initialState.playbackState;

    // Subscribe to player state changes to keep the media session in sync.
    this.subscription = this.player.subscribe(this.syncState.bind(this));

    // Set up static action handlers that just delegate to the player.
    try {
      navigator.mediaSession.setActionHandler('play', () => { this.player?.play().catch(e => console.warn("MediaSession: play() action failed.", e)); });
      navigator.mediaSession.setActionHandler('pause', () => this.player?.pause());
      navigator.mediaSession.setActionHandler('stop', () => { this.player?.stop().catch(e => console.warn("MediaSession: stop() action failed.", e)); });
    } catch (error) {
      console.warn('MediaSessionPlugin: Could not set base media session action handlers.', error);
    }
  }

  /**
   * Cleans up resources used by the plugin.
   */
  public destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.player = null;

    if ('mediaSession' in navigator) {
      // Clear metadata and handlers
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
        navigator.mediaSession.setPositionState(undefined);
      }
    }
  }

  /**
   * Synchronizes the Media Session API with the current player state.
   * This is called on every state update from the player.
   * @param state - The current PlayerState.
   */
  private syncState(state: PlayerState): void {
    if (!this.player || !('mediaSession' in navigator) || !window.MediaMetadata) {
      return;
    }

    const { currentTrack, playbackState, isPlaying, duration, currentTime, queue, currentIndex } = state;

    const trackChanged = currentTrack && currentTrack.id !== this.lastSyncedTrackId;
    const justStartedPlaying = playbackState === 'PLAYING' && this.lastPlaybackState !== 'PLAYING';

    // Update metadata if the track changes OR if we just (re)started playing.
    // This ensures a stale session (e.g., from a backgrounded tab) gets refreshed.
    if (currentTrack && (trackChanged || justStartedPlaying)) {
      const metadata = currentTrack.metadata || {};
      const artwork = metadata.artwork ? [{ src: metadata.artwork, sizes: '512x512', type: 'image/jpeg' }] : [];

      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: metadata.title || 'Untitled Track',
          artist: metadata.artist || 'Unknown Artist',
          album: 'on BitSong',
          artwork
        });
        this.lastSyncedTrackId = currentTrack.id;
      } catch (e) {
        console.warn("MediaSessionPlugin: Could not set media session metadata:", e);
      }
    } else if (!currentTrack && this.lastSyncedTrackId !== null) {
      navigator.mediaSession.metadata = null;
      this.lastSyncedTrackId = null;
    }

    // Store the current state for the next comparison
    this.lastPlaybackState = playbackState;

    // Set playback state first
    let sessionPlaybackState: MediaSessionPlaybackState = 'none';
    switch (playbackState) {
      case 'PLAYING':
        sessionPlaybackState = 'playing';
        break;
      case 'PAUSED':
      case 'IDLE':
      case 'ENDED':
        sessionPlaybackState = 'paused';
        break;
      // For LOADING, ERROR, STALLED, it can be considered paused or none. Let's stick with paused for consistency.
      // A loading state shouldn't show as playing.
      case 'LOADING':
      case 'STALLED':
      case 'ERROR':
        sessionPlaybackState = 'paused';
        break;
    }
    try {
      // Avoid redundant sets if the state is already correct
      if (navigator.mediaSession.playbackState !== sessionPlaybackState) {
        navigator.mediaSession.playbackState = sessionPlaybackState;
      }
    } catch (e) {
      console.warn('MediaSessionPlugin: Could not set media session playbackState', e);
    }

    const hasValidDuration = duration > 0 && isFinite(duration);

    // Only set position state if we have a valid duration and the state is playing/paused.
    if ('setPositionState' in navigator.mediaSession) {
      try {
        if (hasValidDuration && (sessionPlaybackState === 'playing' || sessionPlaybackState === 'paused')) {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: 1.0,
            position: Math.min(currentTime, duration),
          });
        } else {
          // Clear position state if duration is invalid or playback is 'none'
          navigator.mediaSession.setPositionState(undefined);
        }
      } catch (e) {
        console.warn("MediaSessionPlugin: Could not set media session position state:", e);
      }
    }

    // Update dynamic action handlers
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
