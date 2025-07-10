import type { StateSubscriber, Subscription, MediaTrack, MediaSource, PlayerPreferences, PlayerPlugin, PluginLoadOptions, PluginMediaControlHandlers, PlayerState, MediaPlayerPublicApi, PlaybackState } from './types';
import { PlayerStateStore, DEFAULT_PREFERENCES } from './state/PlayerStateStore';


export interface MediaPlayerParams {
  plugins: PlayerPlugin[];
  initialState?: Partial<PlayerState>;
  store?: PlayerStateStore;
}

export class MediaPlayer implements MediaPlayerPublicApi {
  private _activePlugin: PlayerPlugin | null = null;
  private _activePluginHandlers: PluginMediaControlHandlers | null = null;
  private _sourcePlugins: PlayerPlugin[];
  private _featurePlugins: PlayerPlugin[];
  private _containerEl: HTMLElement | null = null;
  private _playWhenReady = false;
  private _stateUnsubscribe: (() => void) | null = null;
  private _lastPlaybackState: PlaybackState = 'IDLE';

  public stateStore: PlayerStateStore;

  constructor(params: MediaPlayerParams) {
    this._sourcePlugins = [];
    this._featurePlugins = [];

    // Separate plugins into source handlers and feature plugins
    params.plugins.forEach(plugin => {
      // Default to 'source' plugin if type is not specified
      if (plugin.type === 'feature') {
        this._featurePlugins.push(plugin);
      } else {
        this._sourcePlugins.push(plugin);
      }
    });

    this.stateStore = params.store || new PlayerStateStore(params.initialState);

    // Register all plugins, allowing them to hook into the player instance
    params.plugins.forEach(plugin => {
      plugin.onRegister?.(this);
    });

    // Ensure preferences are set if not provided in initial state
    if (!params.initialState?.preferences) {
      this.stateStore.setPreferences(DEFAULT_PREFERENCES);
    }

    // Subscribe to state changes for internal logic like autoplay
    this._lastPlaybackState = this.stateStore.getState().playbackState;
    this._stateUnsubscribe = this.stateStore.store.subscribe(this._handleStateChange);
  }

  private _handleStateChange = (state: PlayerState) => {
    if (state.playbackState === 'ENDED' && this._lastPlaybackState !== 'ENDED') {
      if (state.preferences.autoplay) {
        this.next();
      }
    }
    this._lastPlaybackState = state.playbackState;
  }

  public subscribe = (callback: StateSubscriber): Subscription => {
    // The subscribe method on PlayerStateStore now handles invoking the callback immediately.
    return this.stateStore.subscribe(callback);
  }

  public getState = (): PlayerState => this.stateStore.getState();

  public setPreferences = (prefs: Partial<PlayerPreferences>): void => {
    this.stateStore.setPreferences(prefs);
  };

  private _findPluginForSource = (source: MediaSource): PlayerPlugin | null => {
    for (const plugin of this._sourcePlugins) {
      if (plugin.isTypeSupported && plugin.isTypeSupported(source)) {
        return plugin;
      }
    }
    return null;
  }

  private _findPrioritizedSources = (track: MediaTrack, mediaType?: 'audio' | 'video'): MediaSource[] => {
    const sources: MediaSource[] = [];
    const sourceExists = (src: MediaSource) => sources.some(s => s.src === src.src);

    const currentPrefs = this.stateStore.getState().preferences;
    const mediaTypesToIterate = mediaType ? [mediaType] : currentPrefs.mediaType;

    for (const mediaTypePref of mediaTypesToIterate) {
      for (const formatPref of currentPrefs.formats) {
        const source = track.sources.find(
          s => s.mediaType === mediaTypePref && s.format === formatPref,
        );
        if (source && !sourceExists(source)) {
          const plugin = this._findPluginForSource(source);
          if (plugin) {
            sources.push(source);
          }
        }
      }
    }

    const relevantTrackSources = mediaType ? track.sources.filter(s => s.mediaType === mediaType) : track.sources;
    // Add remaining sources that have a plugin but didn't match preferences, as fallbacks.
    for (const source of relevantTrackSources) {
      if (!sourceExists(source)) {
        const plugin = this._findPluginForSource(source);
        if (plugin) {
          sources.push(source);
        }
      }
    }

    return sources;
  }

  private _findBestSourceForType = (track: MediaTrack, type: 'audio' | 'video'): MediaSource | null => {
    const currentPrefs = this.stateStore.getState().preferences;
    const sourcesOfType = track.sources.filter(s => s.mediaType === type);

    if (sourcesOfType.length === 0) {
      return null;
    }

    for (const formatPref of currentPrefs.formats) {
      const source = sourcesOfType.find(s => s.format === formatPref);
      if (source) {
        return source;
      }
    }

    // Fallback to the first available source of the correct type if no preferred format matches
    return sourcesOfType[0];
  }

  public setPlaybackType = async (type: 'audio' | 'video'): Promise<void> => {
    const { currentTrack, currentIndex, isPlaying, preferences } = this.stateStore.getState();
    if (!currentTrack || currentIndex === -1) {
      console.warn("MediaPlayer: Cannot set playback type, no current track.");
      return;
    }

    if (this.stateStore.getState().activeSource?.mediaType === type) {
      console.log(`MediaPlayer: Playback type is already '${type}'.`);
      return;
    }

    // The user has chosen a playback type. This should become the new top preference.
    const newMediaTypePrefs: Array<'audio' | 'video'> = [
      type,
      ...preferences.mediaType.filter(t => t !== type)
    ];

    this.stateStore.setPreferences({ mediaType: newMediaTypePrefs });

    // Find the best source based on the NEW preferences for the current track.
    const newSource = this._findBestSourceForType(currentTrack, type);

    if (newSource) {
      // Note: _loadTrack will use the updated preferences to find fallbacks if newSource fails
      await this._loadTrack(currentIndex, isPlaying, newSource);
    } else {
      console.warn(`MediaPlayer: No '${type}' source found for track "${currentTrack.metadata?.title}".`);
    }
  }

  public loadQueue = (tracks: MediaTrack[], containerElement: HTMLElement, startIndex = 0, playImmediately?: boolean): void => {
    this._containerEl = containerElement;
    this._unloadActivePlugin();

    this.stateStore.resetForQueue(tracks);

    if (tracks.length > 0 && startIndex < tracks.length) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(startIndex, playImmediately ?? autoplayPref ?? false);
    } else {
      this.stop();
    }
  };

  private _unloadActivePlugin = async (): Promise<void> => {
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

    this.stateStore.clearPluginData();
  };

  private _performLoadAttempt = async (
    index: number,
    playImmediately: boolean,
    targetSource: MediaSource
  ): Promise<void> => {
    const track = this.stateStore.getState().queue[index];

    if (!track || !this._containerEl) {
      throw new Error("Track or container not available for load attempt.");
    }

    const targetPlugin = this._findPluginForSource(targetSource);
    if (!targetPlugin || !targetPlugin.load) {
      throw new Error(`No plugin supports source: ${targetSource.format} for track ${track.metadata?.title || track.id}`);
    }

    const currentState = this.stateStore.getState();
    const needsPluginChange =
      this._activePlugin !== targetPlugin ||
      currentState.activeSource?.src !== targetSource.src ||
      currentState.currentIndex !== index;

    // Unload previous plugin if changing track or plugin type
    if (needsPluginChange) {
      await this._unloadActivePlugin();
    }

    this.stateStore.startTrackLoad(index, track, targetSource, targetPlugin.name, needsPluginChange);

    this._activePlugin = targetPlugin;
    const { volume, isMuted } = this.stateStore.getState();

    const loadOptions: PluginLoadOptions = {
      containerElement: this._containerEl,
      initialVolume: volume,
      initialMute: isMuted,
      autoplay: playImmediately,
    };

    // The plugin.load() will now throw on failure, to be caught by the retry loop.
    const handlers = await this._activePlugin.load(targetSource, this.stateStore, loadOptions);
    if (!handlers) {
      throw new Error(`Plugin ${this._activePlugin.name} failed to load the source.`);
    }
    this._activePluginHandlers = handlers;

    this.stateStore.postLoadUpdate();
  };

  private _loadTrack = async (
    index: number,
    playImmediately: boolean,
    preferredSource?: MediaSource
  ): Promise<void> => {
    this._playWhenReady = playImmediately;
    const track = this.stateStore.getState().queue[index];

    if (!track || !this._containerEl) {
      this.stateStore.reportError("Track or container not available");
      return;
    }

    // Build a prioritized list of sources to attempt loading.
    const sourcesToTry: MediaSource[] = [];
    if (preferredSource) {
      // If a specific source is requested, try it first.
      sourcesToTry.push(preferredSource);
      // Then, add other sources of the same media type as fallbacks.
      const otherSources = this._findPrioritizedSources(track, preferredSource.mediaType)
        .filter(s => s.src !== preferredSource.src);
      sourcesToTry.push(...otherSources);
    } else {
      // If no preference, get all prioritized sources for the track.
      sourcesToTry.push(...this._findPrioritizedSources(track));
    }

    if (sourcesToTry.length === 0) {
      const errorMsg = `No playable source found for track: ${track.metadata?.title || track.id}`;
      this.stateStore.reportError(errorMsg);
      this.stateStore.store.setState({ currentTrack: track, currentIndex: index, activeSource: null, activePluginName: null });
      return;
    }

    // Attempt to load each source in the list until one succeeds.
    let lastError: Error | null = null;
    let isFirstAttempt = true;
    for (const sourceToTry of sourcesToTry) {
      try {
        // Unload the previous failed attempt's plugin before retrying
        if (!isFirstAttempt) {
          await this._unloadActivePlugin();
        }
        await this._performLoadAttempt(index, playImmediately, sourceToTry);
        // If we get here, loading was successful, so we can exit.
        return;
      } catch (error) {
        console.warn(`MediaPlayer: Failed to load source '${sourceToTry.src}'. Trying next source. Error:`, error);
        lastError = error as Error;
      }
      isFirstAttempt = false;
    }

    // If we've exhausted all sources and none worked.
    if (lastError) {
      const errorMsg = `All available sources failed to load for track: ${track.metadata?.title || track.id}`;
      this.stateStore.reportError(errorMsg);
      // Ensure state reflects the failed track load
      this.stateStore.store.setState({ currentTrack: track, currentIndex: index, activeSource: null, activePluginName: null });
    }
  };

  public setActiveSource = async (newSource: MediaSource): Promise<void> => {
    const { currentTrack, currentIndex, activeSource, isPlaying, preferences } = this.stateStore.getState();
    if (!currentTrack || currentIndex === -1) {
      console.warn("MediaPlayer: Cannot set source, no current track.");
      return;
    }
    if (activeSource?.src === newSource.src) {
      console.log("MediaPlayer: Selected source is already active.");
      return;
    }

    // By selecting a source, the user expresses a preference for both its format and media type.
    // We update the preferences to reflect this choice, making it "stick" for subsequent tracks.
    const newFormats = [
      newSource.format,
      ...preferences.formats.filter(f => f !== newSource.format)
    ];

    const newMediaTypes: Array<'audio' | 'video'> = [
      newSource.mediaType,
      ...preferences.mediaType.filter(t => t !== newSource.mediaType) as Array<'audio' | 'video'>
    ];

    this.stateStore.setPreferences({
      formats: newFormats,
      mediaType: newMediaTypes
    });

    // The preferredSource argument here ensures this new source is tried first for the current load.
    // The updated preferences will apply to subsequent loads (next/prev track).
    await this._loadTrack(currentIndex, isPlaying, newSource);
  }

  public setPluginOption = async (optionId: string): Promise<void> => {
    if (!this._activePluginHandlers?.setPluginOption) {
      console.warn("MediaPlayer: Active plugin does not support setting options.");
      return;
    }
    if (this.stateStore.getState().activePluginOptionId === optionId) {
      console.log("MediaPlayer: Plugin option is already active.");
      return;
    }
    try {
      await this._activePluginHandlers.setPluginOption(optionId);
    } catch (error) {
      console.error("MediaPlayer: Error setting plugin option:", error);
      this.stateStore.reportError((error as Error).message);
    }
  }

  public addToQueue = (track: MediaTrack): void => {
    const currentState = this.stateStore.getState();
    this.stateStore.addToQueue(track);
    if (currentState.currentIndex === -1 && currentState.queue.length === 0 && this._containerEl) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(0, autoplayPref ?? false);
    }
  };

  public play = async (): Promise<void> => {
    const { playbackState, currentTrack } = this.stateStore.getState();
    if (playbackState === 'IDLE' && currentTrack) {
      // If idle but a track is loaded, try to play it. This can happen after 'stop' then 'play'.
      this.jumpTo(this.stateStore.getState().currentIndex);
      return;
    }
    if (playbackState === 'ERROR' || !this._activePluginHandlers?.play) {
      return;
    }
    if (playbackState === 'ENDED' && currentTrack) {
      this.seek(0);
    }
    if (playbackState !== 'PLAYING') {
      try {
        await this._activePluginHandlers.play();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin play:', error);
        this.stateStore.reportError((error as Error).message);
        this.stateStore.reportPaused(); // Revert to paused on play failure
      }
    }
  };

  public pause = (): void => {
    if (this._activePluginHandlers?.pause && this.stateStore.getState().isPlaying) {
      try {
        this._activePluginHandlers.pause();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin pause:', error);
        this.stateStore.reportError((error as Error).message);
      }
    }
  };

  public stop = async (): Promise<void> => {
    await this._unloadActivePlugin();
    this.stateStore.resetPlayback();
  };

  public next = (): void => {
    const { currentIndex, queue, isPlaying } = this.stateStore.getState();
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(nextIndex, isPlaying || (autoplayPref ?? false));
    } else {
      this.stop().then(() => {
        const finalState = this.stateStore.getState();
        if (finalState.playbackState !== 'IDLE' && finalState.playbackState !== 'ENDED') {
          this.stateStore.setPlaybackState('IDLE');
        }
      });
    }
  };

  public previous = (): void => {
    const { currentIndex, queue, isPlaying } = this.stateStore.getState();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(prevIndex, isPlaying || (autoplayPref ?? false));
    }
  };

  public jumpTo = (index: number): void => {
    const { currentIndex, queue, isPlaying, activeSource } = this.stateStore.getState();
    if (index >= 0 && index < queue.length && this._containerEl) {
      if (index === currentIndex && activeSource) {
        this.seek(0);
        if (!isPlaying) this.play().catch(e => console.warn("Re-play on jumpTo same track failed:", e));
      } else {
        const autoplayPref = this.stateStore.getState().preferences.autoplay;
        this._loadTrack(index, isPlaying || (autoplayPref ?? false));
      }
    }
  };

  public seek = (time: number): void => {
    const { duration } = this.stateStore.getState();
    if (!this._activePluginHandlers?.seek || duration === 0) return;
    const newTime = Math.max(0, Math.min(time, duration));

    try {
      this._activePluginHandlers.seek(newTime);
    } catch (error) {
      console.error('MediaPlayer: Error calling plugin seek:', error);
      this.stateStore.reportError((error as Error).message);
    }
  };

  public setVolume = (volume: number): void => {
    const newVolume = Math.max(0, Math.min(1, volume));
    const newMuted = newVolume === 0;

    if (this._activePluginHandlers?.setVolume) {
      try {
        this._activePluginHandlers.setVolume(newVolume, newMuted);
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin setVolume:', error);
        this.stateStore.reportError((error as Error).message);
      }
    } else {
      // If no plugin handler, update state directly. The callback handles pre-mute logic.
      this.stateStore.reportVolumeChange({ volume: newVolume, isMuted: newMuted });
    }
  };

  public toggleMute = (): void => {
    const currentState = this.stateStore.getState();
    if (currentState.isMuted) {
      const preMuteVolume = this.stateStore.getPreMuteVolume();
      this.setVolume(preMuteVolume > 0 ? preMuteVolume : 0.5);
    } else {
      this.setVolume(0);
    }
  };

  public setPlayerContainer = (container: HTMLElement | null): void => {
    this._containerEl = container;
  };

  public getActiveHTMLElement = (): HTMLElement | null => {
    return this._activePluginHandlers?.getHTMLElement?.() || null;
  };

  public destroy = async (): Promise<void> => {
    await this.stop();
    this._stateUnsubscribe?.();
    this._sourcePlugins.forEach(plugin => plugin.destroy());
    this._featurePlugins.forEach(plugin => plugin.destroy());
    this._containerEl = null;
  };
}