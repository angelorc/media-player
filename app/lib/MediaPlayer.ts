
import { createStore } from 'zustand/vanilla';
import type {
  PlayerState,
  StateSubscriber,
  Subscription,
  MediaTrack,
  MediaSource,
  PlayerPreferences,
  PlayerPlugin,
  PluginCallbacks,
  PluginLoadOptions,
  PluginMediaControlHandlers,
  PluginSelectableOption,
  PlayerStore,
} from './types';

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  mediaType: ['video', 'audio'],
  formats: ['youtube', 'opus', 'hls', 'mp4', 'webm', 'ogv', 'mov', 'mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a'],
  autoplay: false,
};

const initialPlayerState: Readonly<PlayerState> = {
  playbackState: 'IDLE',
  isLoading: false,
  isPlaying: false,
  isMuted: false,
  currentTrack: null,
  activeSource: null,
  currentIndex: -1,
  queue: [],
  currentTime: 0,
  duration: 0,
  volume: 1,
  error: null,
  preferences: DEFAULT_PREFERENCES,
  activePluginName: null,
  pluginOptions: [],
  activePluginOptionId: null,
};

export class MediaPlayer {
  private _activePlugin: PlayerPlugin | null = null;
  private _activePluginHandlers: PluginMediaControlHandlers | null = null;
  private _plugins: PlayerPlugin[];

  private store: PlayerStore;
  private _preferences: PlayerPreferences = DEFAULT_PREFERENCES;
  private _preMuteVolume: number;

  private _containerEl: HTMLElement | null = null;

  private _lastSyncedMediaSessionTrackId: string | null = null;

  constructor(plugins: PlayerPlugin[]) {
    this._plugins = plugins;
    this.store = createStore<PlayerState>(() => ({ ...initialPlayerState }));

    const initialState = this.store.getState();
    this._preMuteVolume = initialState.isMuted ? 0.5 : (initialState.volume > 0 ? initialState.volume : 0.5);
    if (this._preferences !== initialState.preferences) {
      this.store.setState({ preferences: this._preferences });
    }

    this._initMediaSession();
  }

  public subscribe(callback: StateSubscriber): Subscription {
    const unsubscribe = this.store.subscribe((state) => callback(state));
    callback(this.store.getState());
    return { unsubscribe };
  }

  private _updateState = (newState: Partial<PlayerState>): void => {
    const currentState = this.store.getState();

    const isNewTrackLoading = newState.currentTrack && currentState.currentTrack && newState.currentTrack.id !== currentState.currentTrack.id;
    const isNewSourceLoading = newState.activeSource && currentState.activeSource && newState.activeSource.src !== currentState.activeSource.src;

    if ((isNewTrackLoading || isNewSourceLoading) && currentState.playbackState === 'LOADING') {
      if (newState.playbackState && newState.playbackState !== 'IDLE' && newState.playbackState !== 'ERROR' && !newState.error) {
        return;
      }
    }

    if (newState.volume !== undefined || newState.isMuted !== undefined) {
      const targetVolume = newState.volume ?? currentState.volume;
      const targetMuted = newState.isMuted ?? currentState.isMuted;

      if (newState.isMuted === true && currentState.isMuted === false) {
        this._preMuteVolume = currentState.volume > 0 ? currentState.volume : 0.5;
      } else if (newState.volume !== undefined && targetVolume > 0 && (newState.isMuted === false || (newState.isMuted === undefined && !currentState.isMuted))) {
        this._preMuteVolume = targetVolume;
      }
    }

    this.store.setState(newState);
  };

  public getState = (): PlayerState => this.store.getState();

  public setPreferences = (prefs: Partial<PlayerPreferences>): void => {
    this._preferences = { ...this._preferences, ...prefs };
    this._updateState({ preferences: this._preferences });
  };

  private _findPluginForSource(source: MediaSource): PlayerPlugin | null {
    for (const plugin of this._plugins) {
      if (plugin.isTypeSupported(source)) {
        return plugin;
      }
    }
    return null;
  }

  private _findBestSource(track: MediaTrack): { source: MediaSource; plugin: PlayerPlugin } | null {
    const currentPrefs = this.store.getState().preferences;
    for (const mediaTypePref of currentPrefs.mediaType) {
      for (const formatPref of currentPrefs.formats) {
        const source = track.sources.find(
          s => s.mediaType === mediaTypePref && s.format === formatPref,
        );
        if (source) {
          const plugin = this._findPluginForSource(source);
          if (plugin) {
            console.log(`MediaPlayer: Found best source matching preferences: ${source.format} (${source.mediaType}) with plugin ${plugin.name}`);
            return { source, plugin };
          }
        }
      }
    }
    for (const source of track.sources) {
      const plugin = this._findPluginForSource(source);
      if (plugin) {
        console.warn(`MediaPlayer: Fallback - Using source ${source.format} (${source.mediaType}) handled by ${plugin.name}`);
        return { source, plugin };
      }
    }
    console.warn(`MediaPlayer: No playable source found for track "${track.metadata?.title}".`);
    return null;
  }

  public loadQueue = (tracks: MediaTrack[], containerElement: HTMLElement, startIndex = 0, playImmediately?: boolean): void => {
    this._containerEl = containerElement;
    this._unloadActivePlugin();

    this._updateState({
      queue: tracks,
      currentIndex: -1,
      currentTrack: null,
      activeSource: null,
      activePluginName: null,
      pluginOptions: [],
      activePluginOptionId: null,
      playbackState: 'IDLE',
      error: null,
    });
    if (tracks.length > 0 && startIndex < tracks.length) {
      const autoplayPref = this.store.getState().preferences.autoplay;
      this._loadTrack(startIndex, playImmediately ?? autoplayPref ?? false);
    } else {
      this.stop();
    }
  };

  private _unloadActivePlugin = async () => {
    if (this._activePluginHandlers?.stop) {
      try {
        await this._activePluginHandlers.stop();
      } catch (e) {
        console.error("MediaPlayer: Error stopping plugin during unload:", e);
      }
    }
    if (this._activePlugin?.onTrackUnload) {
      this._activePlugin.onTrackUnload();
    }
    this._activePlugin = null;
    this._activePluginHandlers = null;

    const currentState = this.store.getState();
    if (currentState.pluginOptions?.length || currentState.activePluginOptionId) {
      this._updateState({ pluginOptions: [], activePluginOptionId: null });
    }
  };

  private _loadTrack = async (
    index: number,
    playImmediately: boolean,
    preferredSource?: MediaSource,
    mediaElement?: HTMLVideoElement | HTMLAudioElement
  ): Promise<void> => {
    const currentState = this.store.getState();
    const track = currentState.queue[index];

    if (!track || !this._containerEl) {
      this._updateState({ error: "Track or container not available", playbackState: 'ERROR', isLoading: false });
      return;
    }

    const targetSource = preferredSource || this._findBestSource(track)?.source;
    if (!targetSource) {
      const errorMsg = `No playable source found for track: ${track.metadata?.title || track.id}`;
      this._updateState({ error: errorMsg, playbackState: 'ERROR', isLoading: false, currentTrack: track, currentIndex: index, activeSource: null, activePluginName: null });
      return;
    }

    const targetPlugin = this._findPluginForSource(targetSource);
    if (!targetPlugin) {
      const errorMsg = `No plugin supports source: ${targetSource.format} for track ${track.metadata?.title || track.id}`;
      this._updateState({ error: errorMsg, playbackState: 'ERROR', isLoading: false, currentTrack: track, currentIndex: index, activeSource: targetSource, activePluginName: null });
      return;
    }

    const needsPluginChange =
      this._activePlugin !== targetPlugin ||
      currentState.activeSource?.src !== targetSource.src ||
      currentState.currentIndex !== index;

    if (needsPluginChange) {
      await this._unloadActivePlugin();
    }

    const currentDuration = track.duration || currentState.duration || 0;

    this._updateState({
      isLoading: true,
      playbackState: 'LOADING',
      currentIndex: index,
      currentTrack: track,
      activeSource: targetSource,
      activePluginName: targetPlugin.name,
      duration: needsPluginChange ? 0 : currentDuration,
      currentTime: needsPluginChange ? 0 : currentState.currentTime,
      error: null,
      ...(needsPluginChange && { pluginOptions: [], activePluginOptionId: null }),
    });

    this._activePlugin = targetPlugin;
    const { volume, isMuted } = this.store.getState();

    const pluginCallbacks: PluginCallbacks = {
      onLoading: () => this._updateState({ isLoading: true, playbackState: 'LOADING' }),
      onLoadedMetadata: (metadata) => this._updateState({ duration: metadata.duration, isLoading: false }),
      onCanPlay: () => {
        this._updateState({ isLoading: false });
        const latestState = this.store.getState();
        if (playImmediately && (latestState.playbackState === 'LOADING' || latestState.playbackState === 'PAUSED')) {
          this.play().catch(e => console.warn("Autoplay after onCanPlay failed:", e));
        } else if (!latestState.isPlaying && latestState.playbackState !== 'ERROR' && latestState.playbackState !== 'PLAYING') {
          this._updateState({ playbackState: 'PAUSED' });
        }
      },
      onPlaying: () => this._updateState({ isPlaying: true, isLoading: false, playbackState: 'PLAYING', error: null }),
      onPaused: () => this._updateState({ isPlaying: false, playbackState: 'PAUSED' }),
      onEnded: () => {
        const endedState = this.store.getState();
        this._updateState({ isPlaying: false, playbackState: 'ENDED', currentTime: endedState.duration });
        this.next();
      },
      onTimeUpdate: (data) => this._updateState({ currentTime: data.currentTime, duration: data.duration ?? this.store.getState().duration }),
      onDurationChange: (data) => this._updateState({ duration: data.duration }),
      onError: (message, fatal, details) => {
        console.error("MediaPlayer: Plugin Error:", message, "Fatal:", fatal, "Details:", details);
        this._updateState({ error: message, playbackState: 'ERROR', isLoading: false, isPlaying: false });
      },
      onStalled: () => this._updateState({ isLoading: true, playbackState: 'STALLED' }),
      onWaiting: () => this._updateState({ isLoading: true, playbackState: 'LOADING' }),
      onVolumeChange: (data) => this._updateState({ volume: data.volume, isMuted: data.isMuted }),

      onPluginOptionsAvailable: (options: PluginSelectableOption[]) => {
        this._updateState({ pluginOptions: options });
      },
      onPluginOptionChanged: (optionId: string) => {
        this._updateState({ activePluginOptionId: optionId });
      },
    };

    const loadOptions: PluginLoadOptions & { mediaElement?: HTMLVideoElement | HTMLAudioElement } = {
      containerElement: this._containerEl,
      initialVolume: volume,
      initialMute: isMuted,
      autoplay: playImmediately,
      mediaElement: mediaElement,
    };

    try {
      if (needsPluginChange || !this._activePluginHandlers) {
        const handlers = await this._activePlugin.load(targetSource, pluginCallbacks, loadOptions);
        this._activePluginHandlers = handlers || null;
      } else {
        if (playImmediately) this.play().catch(e => console.warn("Re-play after no-op load failed:", e));
      }

      const postLoadState = this.store.getState();
      if (postLoadState.playbackState === 'LOADING' && !postLoadState.isPlaying && !postLoadState.error) {
        this._updateState({ playbackState: 'PAUSED', isLoading: false });
      }

    } catch (e) {
      const errorMsg = `Error loading track with plugin ${targetPlugin.name}: ${(e as Error).message}`;
      console.error(errorMsg, e);
      this._updateState({ error: errorMsg, playbackState: 'ERROR', isLoading: false, isPlaying: false });
    }
  };

  public async setActiveSource(newSource: MediaSource, mediaElement?: HTMLVideoElement | HTMLAudioElement): Promise<void> {
    const { currentTrack, currentIndex, activeSource, isPlaying } = this.store.getState();
    if (!currentTrack || currentIndex === -1) {
      console.warn("MediaPlayer: Cannot set source, no current track.");
      return;
    }
    if (activeSource?.src === newSource.src) {
      console.log("MediaPlayer: Selected source is already active.");
      return;
    }
    await this._loadTrack(currentIndex, isPlaying, newSource, mediaElement);
  }

  public async setPluginOption(optionId: string): Promise<void> {
    if (!this._activePluginHandlers?.setPluginOption) {
      console.warn("MediaPlayer: Active plugin does not support setting options.");
      return;
    }
    if (this.store.getState().activePluginOptionId === optionId) {
      console.log("MediaPlayer: Plugin option is already active.");
      return;
    }
    try {
      await this._activePluginHandlers.setPluginOption(optionId);
    } catch (error) {
      console.error("MediaPlayer: Error setting plugin option:", error);
      this._updateState({ error: (error as Error).message, isLoading: false });
    }
  }

  public addToQueue = (track: MediaTrack): void => {
    const currentState = this.store.getState();
    const newQueue = [...currentState.queue, track];
    this._updateState({ queue: newQueue });
    if (currentState.currentIndex === -1 && newQueue.length === 1 && this._containerEl) {
      const autoplayPref = this.store.getState().preferences.autoplay;
      this._loadTrack(0, autoplayPref ?? false);
    }
  };

  public play = async (): Promise<void> => {
    const { playbackState } = this.store.getState();
    if (playbackState === 'ERROR' || !this._activePluginHandlers?.play) {
      return;
    }
    if (playbackState !== 'PLAYING') {
      try {
        await this._activePluginHandlers.play();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin play:', error);
        this._updateState({ playbackState: 'PAUSED', isPlaying: false, isLoading: false, error: (error as Error).message });
      }
    }
  };

  public pause = (): void => {
    if (this._activePluginHandlers?.pause && this.store.getState().isPlaying) {
      try {
        this._activePluginHandlers.pause();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin pause:', error);
        this._updateState({ error: (error as Error).message });
      }
    }
  };

  public stop = async (): Promise<void> => {
    await this._unloadActivePlugin();
    this._updateState({
      playbackState: 'IDLE',
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      currentTrack: null,
      activeSource: null,
      currentIndex: -1,
      activePluginName: null,
      error: null,
      pluginOptions: [],
      activePluginOptionId: null,
    });
  };

  public next = (): void => {
    const { currentIndex, queue, isPlaying } = this.store.getState();
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const autoplayPref = this.store.getState().preferences.autoplay;
      this._loadTrack(nextIndex, isPlaying || (autoplayPref ?? false));
    } else {
      this.stop().then(() => {
        const finalState = this.store.getState();
        if (finalState.playbackState !== 'IDLE' && finalState.playbackState !== 'ENDED') {
          this._updateState({ playbackState: 'IDLE' });
        }
      });
    }
  };

  public previous = (): void => {
    const { currentIndex, queue, isPlaying } = this.store.getState();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const autoplayPref = this.store.getState().preferences.autoplay;
      this._loadTrack(prevIndex, isPlaying || (autoplayPref ?? false));
    }
  };

  public jumpTo = (index: number): void => {
    const { currentIndex, queue, isPlaying, activeSource } = this.store.getState();
    if (index >= 0 && index < queue.length && this._containerEl) {
      if (index === currentIndex && activeSource) {
        this.seek(0);
        if (!isPlaying) this.play().catch(e => console.warn("Re-play on jumpTo same track failed:", e));
      } else {
        const autoplayPref = this.store.getState().preferences.autoplay;
        this._loadTrack(index, isPlaying || (autoplayPref ?? false));
      }
    }
  };

  public seek = (time: number): void => {
    const { duration } = this.store.getState();
    if (!this._activePluginHandlers?.seek || duration === 0) return;
    const newTime = Math.max(0, Math.min(time, duration));
    try {
      this._activePluginHandlers.seek(newTime);
    } catch (error) {
      console.error('MediaPlayer: Error calling plugin seek:', error);
      this._updateState({ error: (error as Error).message });
    }
  };

  public setVolume = (volume: number): void => {
    const newVolume = Math.max(0, Math.min(1, volume));
    const newMuted = newVolume === 0;
    const currentState = this.store.getState();

    if (newMuted && !currentState.isMuted) {
      this._preMuteVolume = currentState.volume > 0 ? currentState.volume : 0.5;
    } else if (!newMuted && newVolume > 0) {
      this._preMuteVolume = newVolume;
    }

    if (this._activePluginHandlers?.setVolume) {
      try {
        this._activePluginHandlers.setVolume(newVolume, newMuted);
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin setVolume:', error);
        this._updateState({ error: (error as Error).message, volume: newVolume, isMuted: newMuted });
      }
    } else {
      this._updateState({ volume: newVolume, isMuted: newMuted });
    }
  };

  public toggleMute = (): void => {
    const currentState = this.store.getState();
    if (currentState.isMuted) {
      this.setVolume(this._preMuteVolume > 0 ? this._preMuteVolume : 0.5);
    } else {
      this.setVolume(0);
    }
  };

  public setPlayerContainer(container: HTMLElement | null): void {
    this._containerEl = container;
  }

  public getActiveHTMLElement = (): HTMLElement | null => {
    return this._activePluginHandlers?.getHTMLElement?.() || null;
  }

  private _initMediaSession(): void {
    if (!('mediaSession' in navigator)) {
      return;
    }

    this.subscribe(this._syncMediaSessionState.bind(this));

    try {
      navigator.mediaSession.setActionHandler('play', () => { this.play().catch(e => console.warn("MediaSession: play() action failed.", e)); });
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => { this.stop().catch(e => console.warn("MediaSession: stop() action failed.", e)); });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const seekOffset = details.seekOffset || 10;
        this.seek(this.getState().currentTime - seekOffset);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const seekOffset = details.seekOffset || 10;
        this.seek(this.getState().currentTime + seekOffset);
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== null && details.seekTime !== undefined && !details.fastSeek) {
          this.seek(details.seekTime);
        }
      });
    } catch (error) {
      console.warn('MediaPlayer: Could not set some media session action handlers.', error);
    }
  }

  private _syncMediaSessionState(state: PlayerState): void {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) {
      return;
    }

    const { currentTrack, playbackState, duration, currentTime, queue, currentIndex } = state;

    if (currentTrack && currentTrack.id !== this._lastSyncedMediaSessionTrackId) {
      const { title, artist, album, artwork } = currentTrack.metadata || {};
      const artworkArray = artwork ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }] : [];

      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: title || 'Untitled Track',
          artist: artist || 'Unknown Artist',
          album: album || 'Unknown Album',
          artwork: artworkArray
        });
        this._lastSyncedMediaSessionTrackId = currentTrack.id;
      } catch (e) {
        console.warn("Could not set media session metadata:", e);
      }
    } else if (!currentTrack && this._lastSyncedMediaSessionTrackId !== null) {
      navigator.mediaSession.metadata = null;
      this._lastSyncedMediaSessionTrackId = null;
    }

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
      console.warn('Could not set media session playbackState', e);
    }

    // if ('setPositionState' in navigator.mediaSession) {
    //   try {
    //     if (duration > 0 && isFinite(duration)) {
    //       navigator.mediaSession.setPositionState({
    //         duration: duration,
    //         playbackRate: 1.0,
    //         position: currentTime,
    //       });
    //     } else {
    //       navigator.mediaSession.setPositionState(null);
    //     }
    //   } catch (e) {
    //     console.warn("Could not set media session position state:", e);
    //   }
    // }

    const hasValidDuration = duration > 0 && isFinite(duration);
    const isPlaying = playbackState === 'PLAYING';

    if ('setPositionState' in navigator.mediaSession) {
          try {
            if (hasValidDuration) {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: isPlaying ? 1.0 : 0.0,
                    position: Math.min(currentTime, duration),
                });
            } else {
                navigator.mediaSession.setPositionState();
            }
          } catch(e) {
            console.warn("Could not set media session position state:", e);
          }
    }

    try {
      const canNext = currentIndex >= 0 && currentIndex < queue.length - 1;
      navigator.mediaSession.setActionHandler('nexttrack', canNext ? () => this.next() : null);

      const canPrevious = currentIndex > 0;
      navigator.mediaSession.setActionHandler('previoustrack', canPrevious ? () => this.previous() : null);
    } catch (error) {
      console.warn('MediaPlayer: Could not set next/previous track handlers.', error);
    }
  }

  public destroy = async (): Promise<void> => {
    await this.stop();
    this._plugins.forEach(plugin => plugin.destroy?.());
    this._containerEl = null;
  };
}