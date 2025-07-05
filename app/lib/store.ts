import type { StoreApi } from 'zustand/vanilla';
import { createStore } from 'zustand/vanilla';
import type { StoreActions, StoreState, PlayerStore } from './types';

// The initial state for a fresh player instance.
const initialState: StoreState = {
  // media
  source: null,
  duration: 0,
  isReady: false,
  error: null,
  // playback
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  isEnded: false,
  currentTime: 0,
  buffered: 0,
  // properties
  volume: 1,
  playbackRate: 1,
  // queue
  queue: [],
  currentIndex: -1,
};

// --- SLICES ---
// Each slice is a function that creates a part of the store. This keeps the code organized.

const createMediaSlice = (set: StoreApi<PlayerStore>['setState']): StoreActions['media'] => ({
  setSource: (source) => set({ source }),
  setDuration: (duration) => set({ duration }),
  setIsReady: (isReady) => set({ isReady }),
  setError: (error) => set({ error }),
  reset: () => set({ 
    duration: 0, 
    isReady: false, 
    error: null,
    isPlaying: false,
    isBuffering: false,
    isEnded: false,
    currentTime: 0,
    buffered: 0,
  }),
});

const createPlaybackSlice = (set: StoreApi<PlayerStore>['setState']): StoreActions['playback'] => ({
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsBuffering: (isBuffering) => set({ isBuffering }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsEnded: (isEnded) => set({ isEnded }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setBuffered: (buffered) => set({ buffered }),
});

const createPropertiesSlice = (set: StoreApi<PlayerStore>['setState']): StoreActions['properties'] => ({
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
});

const createQueueSlice = (
  set: StoreApi<PlayerStore>['setState'],
  get: StoreApi<PlayerStore>['getState']
): StoreActions['queue'] => ({
  set: (sources) => {
    set({
      queue: sources,
      // If we set a new queue, the current index should be reset.
      // The player will then decide which index to play (usually 0).
      currentIndex: sources.length > 0 ? 0 : -1,
    });
  },
  add: (sources) => {
    set({ queue: [...get().queue, ...sources] });
  },
  remove: (index) => {
    const currentQueue = get().queue;
    if (index < 0 || index >= currentQueue.length) return;
    set({ queue: currentQueue.filter((_, i) => i !== index) });
    // This is a simplification. A more robust implementation might
    // adjust currentIndex if an item before it is removed.
  },
  clear: () => set({ queue: [], currentIndex: -1 }),
  goNext: () => {
    const { queue, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      set({ currentIndex: nextIndex });
      return nextIndex;
    }
    return -1; // No next item
  },
  goPrevious: () => {
    const { currentIndex } = get();
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      set({ currentIndex: prevIndex });
      return prevIndex;
    }
    return -1; // No previous item
  },
  jumpTo: (index) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      set({ currentIndex: index });
    }
  },
});

// --- STORE CREATION ---

/**
 * Creates the central Zustand store for the player.
 */
export function createPlayerStore(): StoreApi<PlayerStore> {
  return createStore<PlayerStore>((set, get) => ({
    ...initialState,
    actions: {
      media: createMediaSlice(set),
      playback: createPlaybackSlice(set),
      properties: createPropertiesSlice(set),
      queue: createQueueSlice(set, get)
    },
  }));
}