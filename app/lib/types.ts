import type { StoreApi } from 'zustand/vanilla';
import type { PlayerError } from './errors';

/**
 * The configuration object provided when creating a new Player instance.
 */
export interface PlayerOptions {
  /** The container element where the media element will be attached. */
  container: HTMLElement;
  /** An array of provider classes to be used by the player. */
  providers: IProviderConstructor[];
  /** The initial source URL to load. */
  source?: string;
}

/**
 * The central context object, passed to all modules (providers, plugins).
 * It's the nervous system of the player.
 */
export interface PlayerContext {
  store: StoreApi<PlayerStore>;
  events: PlayerEventBus;
  player: import('./player').Player; // Use import() for type-only circular refs
  providers: import('./providers/manager').ProviderManager;
}

// --- STORE ---

/**
 * The complete state managed by Zustand. Organized into slices.
 */
export interface StoreState {
  // Media Slice: Core properties of the currently loaded media
  source: string | null;
  duration: number;
  isReady: boolean;
  error: PlayerError | null;
  
  // Playback Slice: State that changes frequently during playback
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  isEnded: boolean;
  currentTime: number;
  buffered: number; // Time in seconds
  
  // Properties Slice: User-adjustable media properties
  volume: number; // From 0 to 1
  playbackRate: number;

  queue: string[];
  currentIndex: number;
}

/**
 * Actions that can be dispatched to modify the store's state.
 */
export interface StoreActions {
  // Actions are namespaced by their slice for clarity.
  media: {
    setSource: (source: string) => void;
    setDuration: (duration: number) => void;
    setIsReady: (isReady: boolean) => void;
    setError: (error: PlayerError | null) => void;
    reset: () => void;
  };
  playback: {
    setIsPlaying: (isPlaying: boolean) => void;
    setIsBuffering: (isBuffering: boolean) => void;
    setIsMuted: (isMuted: boolean) => void;
    setIsEnded: (isEnded: boolean) => void;
    setCurrentTime: (time: number) => void;
    setBuffered: (buffered: number) => void;
  };
  properties: {
    setVolume: (volume: number) => void;
    setPlaybackRate: (rate: number) => void;
  };
  queue: {
    set: (sources: string[]) => void;
    add: (sources: string[]) => void;
    remove: (index: number) => void;
    clear: () => void;
    goNext: () => number;
    goPrevious: () => number;
    jumpTo: (index: number) => void;
  };
}

/** The combined Zustand store interface. */
export type PlayerStore = StoreState & { actions: StoreActions };

// --- PROVIDERS ---

/**
 * The interface that every media provider (Native Video, HLS, YouTube) must implement.
 * This is the contract that ensures providers are interchangeable.
 */
export interface IProvider {
  /** A method to check if this provider can play a given source. */
  canPlay(source: string): boolean;
  /** Loads the media source. */
  load(source: string): void;
  /** Destroys the provider instance, cleaning up elements and event listeners. */
  destroy(): void;

  // Media Controls
  play(): void;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
}

/** Represents a class that can be instantiated to create an IProvider. */
export interface IProviderConstructor {
  new (context: PlayerContext, container: HTMLElement): IProvider;
}

// --- EVENTS ---

/** A map of all possible events the player can emit. */
export interface PlayerEventMap {
  'source:change': { newSource: string };
  'state:change': { state: Partial<StoreState> };
  'error': { error: PlayerError };
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  'destroy': void;
}

/** The type for the event bus, our simple pub/sub system. */
export interface PlayerEventBus {
  on<K extends keyof PlayerEventMap>(event: K, callback: (payload: PlayerEventMap[K]) => void): void;
  off<K extends keyof PlayerEventMap>(event: K, callback: (payload: PlayerEventMap[K]) => void): void;
  emit<K extends keyof PlayerEventMap>(event: K, payload: PlayerEventMap[K]): void;
}