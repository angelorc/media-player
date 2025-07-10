import type { StoreApi } from 'zustand/vanilla';
import { createStore } from 'zustand/vanilla';
import type { PlayerState, PlayerPreferences, StateSubscriber, Subscription, MediaTrack, MediaSource, PluginSelectableOption, PlaybackState } from '../types';

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  mediaType: ['video', 'audio'],
  formats: ['youtube', 'opus', 'hls', 'mp4', 'webm', 'ogv', 'mov', 'mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a'],
  autoplay: true,
};

const initialPlayerStateDefinition: Readonly<PlayerState> = {
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

/**
 * Manages the state of the media player using a Zustand store.
 * Encapsulates state update logic via a declarative API.
 */
export class PlayerStateStore {
  public store: StoreApi<PlayerState>;
  private _preMuteVolume: number;

  constructor(initialState: Partial<PlayerState> = {}) {
    const finalInitialState = { ...initialPlayerStateDefinition, ...initialState };
    this.store = createStore<PlayerState>(() => finalInitialState);
    
    this._preMuteVolume = finalInitialState.isMuted 
      ? 0.5 
      : (finalInitialState.volume > 0 ? finalInitialState.volume : 0.5);
  }

  // --- Core Methods ---
  public getState = (): PlayerState => this.store.getState();
  
  public subscribe = (callback: StateSubscriber): Subscription => {
      const unsubscribe = this.store.subscribe(callback);
      callback(this.getState());
      return { unsubscribe };
  }
  
  public getPreMuteVolume = (): number => this._preMuteVolume;
  public setPreMuteVolume = (volume: number): void => { this._preMuteVolume = volume; }
  
  // --- State Action API ---
  
  public setPreferences = (prefs: Partial<PlayerPreferences>): void => {
    const currentPrefs = this.getState().preferences;
    this.store.setState({ preferences: { ...currentPrefs, ...prefs } });
  }

  public resetForQueue = (tracks: MediaTrack[]): void => {
    this.store.setState({
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
  }

  public clearPluginData = () => {
    const currentState = this.getState();
    if (currentState.pluginOptions?.length || currentState.activePluginOptionId) {
      this.store.setState({ pluginOptions: [], activePluginOptionId: null });
    }
  }

  public startTrackLoad = (index: number, track: MediaTrack, targetSource: MediaSource, targetPluginName: string, needsPluginChange: boolean): void => {
    const currentState = this.getState();

    // If a new track is being loaded, use its metadata duration if available, otherwise reset to 0.
    // If just the source is changing for the same track, keep the current duration.
    const newDuration = needsPluginChange ? (track.duration ?? 0) : currentState.duration;
    
    this.store.setState({
        isLoading: true,
        playbackState: 'LOADING',
        currentIndex: index,
        currentTrack: track,
        activeSource: targetSource,
        activePluginName: targetPluginName,
        currentTime: needsPluginChange ? 0 : currentState.currentTime,
        duration: newDuration,
        error: null,
        // If plugin changes, also clear plugin-specific options from the old plugin
        ...(needsPluginChange && { pluginOptions: [], activePluginOptionId: null }),
    });
  }
  
  public reportCanPlay = () => {
    this.store.setState({ isLoading: false }); 
    const latestState = this.getState();
    if (!latestState.isPlaying && latestState.playbackState !== 'ERROR' && latestState.playbackState !== 'PLAYING') {
      this.store.setState({ playbackState: 'PAUSED' });
    }
  }

  public reportPlaying = () => this.store.setState({ isPlaying: true, isLoading: false, playbackState: 'PLAYING', error: null });
  public reportPaused = () => this.store.setState({ isPlaying: false, playbackState: 'PAUSED' });
  public reportEnded = () => {
    const endedState = this.getState();
    this.store.setState({ isPlaying: false, playbackState: 'ENDED', currentTime: endedState.duration });
  };
  
  public reportLoading = () => this.store.setState({ isLoading: true, playbackState: 'LOADING' });
  public reportStalled = () => this.store.setState({ isLoading: true, playbackState: 'STALLED' });
  public reportWaiting = () => this.store.setState({ isLoading: true, playbackState: 'LOADING' });

  public reportTimeUpdate = (data: { currentTime: number, duration?: number }) => this.store.setState({ currentTime: data.currentTime, duration: data.duration ?? this.getState().duration });
  public reportDurationChange = (data: { duration: number }) => this.store.setState({ duration: data.duration });
  public reportLoadedMetadata = (metadata: { duration: number }) => this.store.setState({ duration: metadata.duration, isLoading: false });

  public reportError = (message: string) => this.store.setState({ error: message, playbackState: 'ERROR', isLoading: false, isPlaying: false });

  public reportVolumeChange = (data: { volume: number; isMuted: boolean; }) => {
    const currentState = this.getState();
    if (data.isMuted && !currentState.isMuted) {
      this.setPreMuteVolume(currentState.volume > 0 ? currentState.volume : 0.5);
    } else if (!data.isMuted && data.volume > 0) {
      this.setPreMuteVolume(data.volume);
    }
    this.store.setState(data);
  }

  public reportPluginOptionsAvailable = (options: PluginSelectableOption[]) => this.store.setState({ pluginOptions: options });
  public reportPluginOptionChanged = (optionId: string) => this.store.setState({ activePluginOptionId: optionId });

  public addToQueue = (track: MediaTrack) => {
      const currentState = this.getState();
      const newQueue = [...currentState.queue, track];
      this.store.setState({ queue: newQueue });
  }

  public resetPlayback = () => {
    this.store.setState({
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
  }
  
  public postLoadUpdate = () => {
    const postLoadState = this.getState();
    if (postLoadState.playbackState === 'LOADING' && !postLoadState.isPlaying && !postLoadState.error) {
      this.store.setState({ playbackState: 'PAUSED', isLoading: false });
    }
  }

  public setPlaybackState = (state: PlaybackState) => {
    this.store.setState({ playbackState: state });
  }
}