
import type { Level as HlsJsLevel } from 'hls.js';

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

export interface PluginCallbacks {
  onReady?: () => void;
  onLoading: () => void;
  onLoadedMetadata: (metadata: { duration: number }) => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onPaused: () => void;
  onEnded: () => void;
  onSeeking?: () => void;
  onSeeked?: () => void;
  onTimeUpdate: (data: { currentTime: number, duration?: number }) => void;
  onDurationChange?: (data: { duration: number }) => void;
  onVolumeChange?: (data: { volume: number, isMuted: boolean }) => void;
  onError: (message: string, fatal: boolean, details?: unknown) => void;
  onStalled?: () => void;
  onWaiting?: () => void;
  onStateChange?: (stateChanges: Partial<Pick<PlayerState, 'playbackState' | 'isLoading' | 'isPlaying' | 'currentTime' | 'duration' | 'error'>>) => void;

  // Generic callbacks for plugins to provide their internal selectable options
  onPluginOptionsAvailable?: (options: PluginSelectableOption[]) => void;
  onPluginOptionChanged?: (optionId: string) => void; // Plugin indicates its active internal option
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

export interface PlayerPlugin {
  name: string;
  isTypeSupported(source: MediaSource): boolean;
  load(
    source: MediaSource,
    callbacks: PluginCallbacks,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers | void>;
  onTrackUnload(): void; // Called when the plugin is about to be replaced or track stops
  destroy(): void;
}
