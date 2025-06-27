import { ref, computed, watch, onUnmounted } from 'vue';
import type { PlayerState, Subscription } from '@/lib/types';

export function useMediaPlayer(mediaPlayerRef: any) {
  const state = ref<PlayerState | null>(null);
  const subscription = ref<Subscription | null>(null);

  // Computed properties for common state checks
  const isPlaying = computed(() => state.value?.isPlaying ?? false);
  const isLoading = computed(() => state.value?.isLoading ?? false);
  const hasError = computed(() => !!state.value?.error);
  const isVideo = computed(() => state.value?.activeSource?.mediaType === 'video');
  const isAudio = computed(() => state.value?.activeSource?.mediaType === 'audio');
  const hasCurrentTrack = computed(() => !!state.value?.currentTrack);
  const canGoNext = computed(() => {
    if (!state.value) return false;
    return state.value.currentIndex < state.value.queue.length - 1;
  });
  const canGoPrevious = computed(() => {
    if (!state.value) return false;
    return state.value.currentIndex > 0;
  });
  const progress = computed(() => {
    if (!state.value || !state.value.duration) return 0;
    return state.value.currentTime / state.value.duration;
  });
  const formattedCurrentTime = computed(() => {
    if (!state.value) return '0:00';
    return formatTime(state.value.currentTime);
  });
  const formattedDuration = computed(() => {
    if (!state.value) return '0:00';
    return formatTime(state.value.duration);
  });

  // Helper function to format time
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Watch for changes in mediaPlayerRef and manage subscription
  watch(mediaPlayerRef, (newMediaPlayer, oldMediaPlayer, onCleanup) => {
    // Clean up previous subscription
    if (subscription.value) {
      subscription.value.unsubscribe();
      subscription.value = null;
    }

    if (!newMediaPlayer) {
      state.value = null;
      return;
    }

    try {
      // Subscribe to state changes
      subscription.value = newMediaPlayer.subscribe((newState: PlayerState) => {
        state.value = newState;
      });

      // The onCleanup function is called when the watcher is stopped
      // or before the callback is executed again.
      onCleanup(() => {
        if (subscription.value) {
          subscription.value.unsubscribe();
          subscription.value = null;
        }
      });
    } catch (error) {
      console.error('Error subscribing to media player state:', error);
      state.value = null;
    }
  }, { immediate: true }); // immediate: true runs the callback right away

  // Clean up subscription when component unmounts
  onUnmounted(() => {
    if (subscription.value) {
      subscription.value.unsubscribe();
      subscription.value = null;
    }
  });

  // Return reactive state and computed properties
  return {
    // Raw state
    state,
    
    // Computed properties
    isPlaying,
    isLoading,
    hasError,
    isVideo,
    isAudio,
    hasCurrentTrack,
    canGoNext,
    canGoPrevious,
    progress,
    formattedCurrentTime,
    formattedDuration,
    
    // Helper functions
    formatTime,
  };
}
