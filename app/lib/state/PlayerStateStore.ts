import type { StoreApi } from 'zustand/vanilla';
import { createStore } from 'zustand/vanilla';
import type { PlayerState, PlayerPreferences, StateSubscriber, Subscription, MediaTrack, MediaSource, PluginSelectableOption, PlaybackState } from '../types';

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  mediaType: ['video', 'audio'],
  formats: ['youtube', 'opus', 'hls', 'mp4', 'webm', 'ogv', 'mov', 'mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a'],
  autoplay: false,
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

  public setQueue = (tracks: MediaTrack[]): void => {
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

  public startTrackChange = (index: number, track: MediaTrack, targetSource: MediaSource, targetPluginName: string, needsPluginChange: boolean): void => {
    const currentState = this.getState();
    const currentDuration = track.duration || currentState.duration || 0;

    this.store.setState({
      isLoading: true,
      playbackState: 'LOADING',
      currentIndex: index,
      currentTrack: track,
      activeSource: targetSource,
      activePluginName: targetPluginName,
      duration: needsPluginChange ? 0 : currentDuration,
      currentTime: needsPluginChange ? 0 : currentState.currentTime,
      error: null,
      ...(needsPluginChange && { pluginOptions: [], activePluginOptionId: null }),
    });
  }
  
  public setCanPlay = () => {
    this.store.setState({ isLoading: false }); 
    const latestState = this.getState();
    if (!latestState.isPlaying && latestState.playbackState !== 'ERROR' && latestState.playbackState !== 'PLAYING') {
      this.store.setState({ playbackState: 'PAUSED' });
    }
  }

  public setPlaying = () => this.store.setState({ isPlaying: true, isLoading: false, playbackState: 'PLAYING', error: null });
  public setPaused = () => this.store.setState({ isPlaying: false, playbackState: 'PAUSED' });
  public setEnded = () => {
    const endedState = this.getState();
    this.store.setState({ isPlaying: false, playbackState: 'ENDED', currentTime: endedState.duration });
  };
  
  public setLoading = () => this.store.setState({ isLoading: true, playbackState: 'LOADING' });
  public setStalled = () => this.store.setState({ isLoading: true, playbackState: 'STALLED' });
  public setWaiting = () => this.store.setState({ isLoading: true, playbackState: 'LOADING' });

  public setTimeUpdate = (data: { currentTime: number, duration?: number }) => this.store.setState({ currentTime: data.currentTime, duration: data.duration ?? this.getState().duration });
  public setDurationChange = (data: { duration: number }) => this.store.setState({ duration: data.duration });
  public setMetadataLoaded = (metadata: { duration: number }) => this.store.setState({ duration: metadata.duration, isLoading: false });

  public setError = (message: string) => this.store.setState({ error: message, playbackState: 'ERROR', isLoading: false, isPlaying: false });

  public setVolume = (data: { volume: number; isMuted: boolean; }) => {
    const currentState = this.getState();
    if (data.isMuted && !currentState.isMuted) {
      this.setPreMuteVolume(currentState.volume > 0 ? currentState.volume : 0.5);
    } else if (!data.isMuted && data.volume > 0) {
      this.setPreMuteVolume(data.volume);
    }
    this.store.setState(data);
  }

  public setPluginOptionsAvailable = (options: PluginSelectableOption[]) => this.store.setState({ pluginOptions: options });
  public setActivePluginOption = (optionId: string) => this.store.setState({ activePluginOptionId: optionId });

  public addToQueue = (track: MediaTrack) => {
      const currentState = this.getState();
      const newQueue = [...currentState.queue, track];
      this.store.setState({ queue: newQueue });
  }

  public reset = () => {
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
  
  public endTrackChange = () => {
    const postLoadState = this.getState();
    if (postLoadState.playbackState === 'LOADING' && !postLoadState.isPlaying && !postLoadState.error) {
      this.store.setState({ playbackState: 'PAUSED', isLoading: false });
    }
  }

  public setPlaybackState = (state: PlaybackState) => {
    this.store.setState({ playbackState: state });
  }
}