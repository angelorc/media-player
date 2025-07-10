import type { PlayerStateStore } from './state/PlayerStateStore';

export interface MediaMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: string; // URL to image
}

export interface MediaSource {
  src: string;
  format: string; // e.g., 'hls', 'mp4', 'mp3', 'youtube'
  mediaType: 'audio' | 'video'; // Helps determine which element to use
  quality?: string; // User-facing label for this source, e.g., '1080p', 'MP3', 'HLS Stream'
}

export interface MediaTrack {
  id: string;
  sources: MediaSource[];
  metadata?: MediaMetadata;
  duration?: number; // in seconds, optional, can be fetched from metadata
}

export type PlaybackState = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR' | 'STALLED';

export interface PlayerPreferences {
  mediaType: Array<'video' | 'audio'>; // Preferred order
  formats: string[]; // Preferred order of formats
  autoplay?: boolean;
}

// Represents an option reported by a plugin (e.g., HLS quality level)
export interface PluginSelectableOption {
  id: string; // Plugin-defined ID for the option (e.g., 'auto', 'level_0')
  label: string; // User-friendly label (e.g., "Auto", "720p (1.2 Mbps)")
}

export interface PlayerState {
  playbackState: PlaybackState;
  isLoading: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  currentTrack: MediaTrack | null;
  activeSource: MediaSource | null; // The fundamental MediaSource being played
  currentIndex: number;
  queue: MediaTrack[];
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  preferences: PlayerPreferences;
  activePluginName: string | null;

  // Generic plugin-selectable options and active selection
  pluginOptions?: PluginSelectableOption[];
  activePluginOptionId?: string | null;
}

export interface StateSubscriber {
  (state: PlayerState): void;
}

export interface Subscription {
  unsubscribe: () => void;
}

export interface PluginLoadOptions {
  containerElement: HTMLElement;
  initialVolume: number;
  initialMute: boolean;
  autoplay: boolean;
}

export interface PluginMediaControlHandlers {
  play: () => Promise<void>;
  pause: () => void;
  stop?: () => void;
  seek: (time: number) => void;
  setVolume?: (volume: number, isMuted: boolean) => void;
  getHTMLElement?: () => HTMLElement | null;
  setPlaybackRate?: (rate: number) => void;
  // Generic handler for plugins to change their internal selectable option
  setPluginOption?: (optionId: string) => Promise<void>;
}


export interface MediaPlayerPublicApi {
    subscribe(callback: StateSubscriber): Subscription;
    getState(): PlayerState;
    loadQueue(tracks: MediaTrack[], containerElement: HTMLElement, startIndex?: number, playImmediately?: boolean): void;
    addToQueue(track: MediaTrack): void;
    play(): Promise<void>;
    pause(): void;
    stop(): Promise<void>;
    next(): void;
    previous(): void;
    jumpTo(index: number): void;
    seek(time: number): void;
    setVolume(volume: number): void;
    toggleMute(): void;
    setPlayerContainer(container: HTMLElement | null): void;
    getActiveHTMLElement(): HTMLElement | null;
    destroy(): Promise<void>;
    setPreferences(prefs: Partial<PlayerPreferences>): void;
    setActiveSource(newSource: MediaSource): Promise<void>;
    setPluginOption(optionId: string): Promise<void>;
    setPlaybackType(type: 'audio' | 'video'): Promise<void>;
}

export interface PlayerPlugin {
  name: string;
  /**
   * Defines the plugin type.
   * 'source' plugins handle media playback for specific formats (e.g., HLS, MP4).
   * 'feature' plugins add functionality across the player (e.g., MediaSession, analytics).
   * Defaults to 'source' if not specified.
   */
  type?: 'source' | 'feature';

  /**
   * Called when the plugin is registered with the MediaPlayer instance.
   * This is the entry point for feature plugins.
   * @param player - The public API of the media player.
   */
  onRegister?(player: MediaPlayerPublicApi): void;
  
  /**
   * (For 'source' plugins) Checks if the plugin can handle the given media source.
   * @param source - The media source to check.
   * @returns `true` if the source is supported, otherwise `false`.
   */
  isTypeSupported?(source: MediaSource): boolean;

  /**
   * (For 'source' plugins) Loads a media source for playback.
   * @param source - The media source to load.
   * @param stateStore - The player's state store for reporting state changes.
   * @param options - Loading options like container element and autoplay settings.
   * @returns A promise that resolves with media control handlers.
   */
  load?(
    source: MediaSource,
    stateStore: PlayerStateStore,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers | void>;

  /**
   * (For 'source' plugins) Called when the track handled by this plugin is being unloaded.
   */
  onTrackUnload?(): void;

  /**
   * Called when the MediaPlayer is being destroyed. The plugin should clean up all its resources.
   */
  destroy(): void;
}
