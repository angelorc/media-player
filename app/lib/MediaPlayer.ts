import type { StateSubscriber, Subscription, MediaTrack, MediaSource, PlayerPreferences, PlayerPlugin, PluginLoadOptions, PluginMediaControlHandlers, PluginSelectableOption, PlayerState, PluginApi, MediaMetadata, PlaybackState, MediaPlayerPublicApi } from './types';
import { PlayerStateStore, DEFAULT_PREFERENCES } from './state/PlayerStateStore';
import { HookableCore } from './HookableCore';


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
  
  public stateStore: PlayerStateStore;
  public hooks: HookableCore;
  public events: HookableCore;

  constructor(params: MediaPlayerParams) {
    // 1. Initialize stateStore first, as other parts depend on it.
    this.stateStore = params.store || new PlayerStateStore(params.initialState);

    // 2. Initialize hooks and event bus.
    this.hooks = new HookableCore();
    this.events = new HookableCore();

    // 3. Setup listeners that connect the event bus to the state store.
    this._setupEventListeners();

    // 4. Separate plugins into source handlers and feature plugins.
    this._sourcePlugins = [];
    this._featurePlugins = [];
    params.plugins.forEach(plugin => {
        // Default to 'source' plugin if type is not specified
        if (plugin.type === 'feature') {
            this._featurePlugins.push(plugin);
        } else {
            this._sourcePlugins.push(plugin);
        }
    });

    // 5. Register all plugins, allowing them to hook into the player instance.
    // Now they can safely call subscribe().
    params.plugins.forEach(plugin => {
        plugin.onRegister?.(this);
    });

    // 6. Ensure preferences are set if not provided in initial state.
    if (!params.initialState?.preferences) {
      this.stateStore.setPreferences(DEFAULT_PREFERENCES);
    }
    
    // 7. Finalize initialization.
    this.hooks.callHook('player:init', { instance: this }).catch(e => console.error("Error in player:init hook:", e));
  }

  private _setupEventListeners() {
    this.events.hook('plugin:loading', () => this.stateStore.setLoading());
    this.events.hook('plugin:loadedmetadata', (metadata: { duration: number }) => this.stateStore.setMetadataLoaded(metadata));
    this.events.hook('plugin:canplay', () => {
      this.stateStore.setCanPlay();
      const latestState = this.stateStore.getState();
      if (this._playWhenReady && (latestState.playbackState === 'LOADING' || latestState.playbackState === 'PAUSED')) {
        this.play().catch(e => console.warn("Autoplay after onCanPlay failed:", e));
      }
      this._playWhenReady = false; // Reset after use
    });
    this.events.hook('plugin:playing', () => {
      this.hooks.callHook('player:playing').catch(e => console.error("Error in player:playing hook:", e));
      this.stateStore.setPlaying();
    });
    this.events.hook('plugin:paused', () => {
      this.hooks.callHook('player:paused').catch(e => console.error("Error in player:paused hook:", e));
      this.stateStore.setPaused();
    });
    this.events.hook('plugin:ended', () => {
      const endedTrack = this.stateStore.getState().currentTrack;
      if (endedTrack) {
        this.hooks.callHook('track:end', { track: endedTrack }).catch(e => console.error("Error in track:end hook:", e));
      }
      this.stateStore.setEnded();
      this.next();
    });
    this.events.hook('plugin:timeupdate', (data: { currentTime: number, duration?: number }) => {
      this.hooks.callHook('player:timeupdate', data).catch(e => console.error("Error in player:timeupdate hook:", e));
      this.stateStore.setTimeUpdate(data);
    });
    this.events.hook('plugin:durationchange', (data: { duration: number }) => this.stateStore.setDurationChange(data));
    this.events.hook('plugin:error', ({ message, fatal, details }: { message: string, fatal: boolean, details?: unknown }) => {
      console.error("MediaPlayer: Plugin Error:", message, "Fatal:", fatal, "Details:", details);
      this.hooks.callHook('player:error', { message, fatal, details }).catch(e => console.error("Error in player:error hook:", e));
      this.stateStore.setError(message);
    });
    this.events.hook('plugin:stalled', () => this.stateStore.setStalled());
    this.events.hook('plugin:waiting', () => this.stateStore.setWaiting());
    this.events.hook('plugin:volumechange', (data: { volume: number, isMuted: boolean }) => this.stateStore.setVolume(data));
    this.events.hook('plugin:optionsavailable', (options: PluginSelectableOption[]) => this.stateStore.setPluginOptionsAvailable(options));
    this.events.hook('plugin:optionchanged', (optionId: string) => this.stateStore.setActivePluginOption(optionId));
  }

  public subscribe(callback: StateSubscriber): Subscription {
    // The subscribe method on PlayerStateStore now handles invoking the callback immediately.
    return this.stateStore.subscribe(callback);
  }

  public getState = (): PlayerState => this.stateStore.getState();

  public setPreferences = (prefs: Partial<PlayerPreferences>): void => {
    this.stateStore.setPreferences(prefs);
  };

  private _findPluginForSource(source: MediaSource): PlayerPlugin | null {
    for (const plugin of this._sourcePlugins) {
      if (plugin.isTypeSupported && plugin.isTypeSupported(source)) {
        return plugin;
      }
    }
    return null;
  }

  private _findBestSource(track: MediaTrack): { source: MediaSource; plugin: PlayerPlugin } | null {
    const currentPrefs = this.stateStore.getState().preferences;
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

    this.stateStore.setQueue(tracks);
    this.hooks.callHook('queue:load', { tracks, startIndex }).catch(e => console.error("Error in queue:load hook:", e));
    
    if (tracks.length > 0 && startIndex < tracks.length) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(startIndex, playImmediately ?? autoplayPref ?? false);
    } else {
      this.stop();
    }
  };

  private _unloadActivePlugin = async () => {
    const trackToUnload = this.getState().currentTrack;
    if (trackToUnload) {
        await this.hooks.callHook('track:unload', { track: trackToUnload });
    }

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

  private _loadTrack = async (
    index: number,
    playImmediately: boolean,
    preferredSource?: MediaSource
  ): Promise<void> => {
    this._playWhenReady = playImmediately;
    const currentState = this.stateStore.getState();
    const track = currentState.queue[index];

    if (!track || !this._containerEl) {
      this.stateStore.setError("Track or container not available");
      return;
    }
    
    await this.hooks.callHook('track:load', { track, index });

    const targetSource = preferredSource || this._findBestSource(track)?.source;
    if (!targetSource) {
      const errorMsg = `No playable source found for track: ${track.metadata?.title || track.id}`;
      this.stateStore.setError(errorMsg);
      this.stateStore.store.setState({ currentTrack: track, currentIndex: index, activeSource: null, activePluginName: null });
      return;
    }

    const targetPlugin = this._findPluginForSource(targetSource);
    if (!targetPlugin || !targetPlugin.load) {
      const errorMsg = `No plugin supports source: ${targetSource.format} for track ${track.metadata?.title || track.id}`;
      this.stateStore.setError(errorMsg);
      this.stateStore.store.setState({ currentTrack: track, currentIndex: index, activeSource: targetSource, activePluginName: null });
      return;
    }
    
    const needsPluginChange =
      this._activePlugin !== targetPlugin ||
      currentState.activeSource?.src !== targetSource.src ||
      currentState.currentIndex !== index;

    if (needsPluginChange) {
      await this._unloadActivePlugin();
    }

    this.stateStore.startTrackChange(index, track, targetSource, targetPlugin.name, needsPluginChange);

    this._activePlugin = targetPlugin;
    const { volume, isMuted } = this.stateStore.getState();

    const loadOptions: PluginLoadOptions = {
      containerElement: this._containerEl,
      initialVolume: volume,
      initialMute: isMuted,
      autoplay: playImmediately,
    };

    const pluginApi: PluginApi = {
        hooks: this.hooks,
        events: this.events
    };

    try {
      if (needsPluginChange || !this._activePluginHandlers) {
        const handlers = await this._activePlugin.load(targetSource, pluginApi, loadOptions);
        this._activePluginHandlers = handlers || null;
      } else {
         if (playImmediately) this.play().catch(e => console.warn("Re-play after no-op load failed:", e));
      }
      
      this.stateStore.endTrackChange();

    } catch (e) {
      const errorMsg = `Error loading track with plugin ${targetPlugin.name}: ${(e as Error).message}`;
      console.error(errorMsg, e);
      this.stateStore.setError(errorMsg);
    }
  };

  public async setActiveSource(newSource: MediaSource): Promise<void> {
    const {currentTrack, currentIndex, activeSource, isPlaying} = this.stateStore.getState();
    if (!currentTrack || currentIndex === -1) {
        console.warn("MediaPlayer: Cannot set source, no current track.");
        return;
    }
    if (activeSource?.src === newSource.src) {
        console.log("MediaPlayer: Selected source is already active.");
        return;
    }
    await this.hooks.callHook('source:change', { newSource });
    await this._loadTrack(currentIndex, isPlaying, newSource);
  }

  public async setPluginOption(optionId: string): Promise<void> {
    if (!this._activePluginHandlers?.setPluginOption) {
        console.warn("MediaPlayer: Active plugin does not support setting options.");
        return;
    }
    if (this.stateStore.getState().activePluginOptionId === optionId) {
        console.log("MediaPlayer: Plugin option is already active.");
        return;
    }
    try {
        await this.hooks.callHook('plugin:optionchange', { optionId });
        await this._activePluginHandlers.setPluginOption(optionId);
    } catch (error) {
        console.error("MediaPlayer: Error setting plugin option:", error);
        this.stateStore.setError((error as Error).message);
    }
  }

  public addToQueue = (track: MediaTrack): void => {
    const currentState = this.stateStore.getState();
    this.stateStore.addToQueue(track);
    this.hooks.callHook('queue:add', { track }).catch(e => console.error("Error in queue:add hook:", e));
    if (currentState.currentIndex === -1 && currentState.queue.length === 0 && this._containerEl) {
      const autoplayPref = this.stateStore.getState().preferences.autoplay;
      this._loadTrack(0, autoplayPref ?? false);
    }
  };

  public play = async (): Promise<void> => {
    const { playbackState } = this.stateStore.getState();
    if (playbackState === 'ERROR' || !this._activePluginHandlers?.play) {
      return;
    }
    if (playbackState !== 'PLAYING') {
      try {
        await this.hooks.callHook('player:play');
        await this._activePluginHandlers.play();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin play:', error);
        this.stateStore.setError((error as Error).message);
        this.stateStore.setPaused(); // Revert to paused on play failure
      }
    }
  };

  public pause = (): void => {
    if (this._activePluginHandlers?.pause && this.stateStore.getState().isPlaying) {
      try {
        this.hooks.callHook('player:pause').catch(e => console.error("Error in player:pause hook:", e));
        this._activePluginHandlers.pause();
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin pause:', error);
        this.stateStore.setError((error as Error).message);
      }
    }
  };

  public stop = async (): Promise<void> => {
    await this._unloadActivePlugin();
    this.stateStore.reset();
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
          if(!isPlaying) this.play().catch(e => console.warn("Re-play on jumpTo same track failed:", e));
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
      this.hooks.callHook('player:seek', { time: newTime }).catch(e => console.error("Error in player:seek hook:", e));
      this._activePluginHandlers.seek(newTime);
    } catch (error)
{
      console.error('MediaPlayer: Error calling plugin seek:', error);
      this.stateStore.setError((error as Error).message);
    }
  };

  public setVolume = (volume: number): void => {
    const newVolume = Math.max(0, Math.min(1, volume));
    const newMuted = newVolume === 0;

    this.hooks.callHook('player:volumechange', { volume: newVolume, isMuted: newMuted }).catch(e => console.error("Error in player:volumechange hook:", e));

    if (this._activePluginHandlers?.setVolume) {
      try {
        this._activePluginHandlers.setVolume(newVolume, newMuted);
      } catch (error) {
        console.error('MediaPlayer: Error calling plugin setVolume:', error);
        this.stateStore.setError((error as Error).message);
      }
    } else {
      // If no plugin handler, update state directly. The callback handles pre-mute logic.
      this.stateStore.setVolume({ volume: newVolume, isMuted: newMuted });
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

  public setPlayerContainer(container: HTMLElement | null): void {
    this._containerEl = container;
  }

  public getActiveHTMLElement = (): HTMLElement | null => {
    return this._activePluginHandlers?.getHTMLElement?.() || null;
  }

  public destroy = async (): Promise<void> => {
    await this.hooks.callHook('player:destroy');
    await this.stop();
    this._sourcePlugins.forEach(plugin => plugin.destroy());
    this._featurePlugins.forEach(plugin => plugin.destroy());
    this._containerEl = null;
    this.hooks.removeAllHooks();
    this.events.removeAllHooks();
  };
}