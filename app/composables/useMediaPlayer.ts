import { ref, computed, readonly, onUnmounted } from 'vue'
import type { PlayerState, Subscription } from '~/lib/types'

/**
 * Composable for accessing the global MediaPlayer instance and reactive state
 * Uses the MediaPlayer instance provided by the Nuxt plugin
 */
export function useMediaPlayer() {
  // Get MediaPlayer instance from Nuxt plugin
  const { $mediaPlayer } = useNuxtApp()
  
  if (!$mediaPlayer) {
    throw new Error('MediaPlayer plugin not found. Make sure the plugin is properly configured.')
  }

  // Reactive state from MediaPlayer
  const state = ref<PlayerState>($mediaPlayer.getState())
  // const state = computed(() => $mediaPlayer.getState())
  
  // Subscribe to state changes from MediaPlayer
  let subscription: Subscription | null = null
  
  try {
    subscription = $mediaPlayer.subscribe((newState: PlayerState) => {
      state.value = newState
    })
  } catch (error) {
    console.error('useMediaPlayer: Failed to subscribe to MediaPlayer state:', error)
  }
  
  // Cleanup subscription on component unmount
  onUnmounted(() => {
    if (subscription) {
      subscription.unsubscribe()
      subscription = null
    }
  })
  
  // Computed properties for common state access
  const isPlaying = computed(() => state.value.isPlaying)
  const isLoading = computed(() => state.value.isLoading)
  const currentTrack = computed(() => state.value.currentTrack)
  const activeSource = computed(() => state.value.activeSource)
  const currentTime = computed(() => state.value.currentTime)
  const duration = computed(() => state.value.duration)
  const volume = computed(() => state.value.volume)
  const isMuted = computed(() => state.value.isMuted)
  const currentIndex = computed(() => state.value.currentIndex)
  const queue = computed(() => state.value.queue)
  const preferences = computed(() => state.value.preferences)
  const playbackState = computed(() => state.value.playbackState)
  const error = computed(() => state.value.error)
  
  // Computed helpers
  const hasCurrentTrack = computed(() => !!currentTrack.value)
  const isVideo = computed(() => activeSource.value?.mediaType === 'video')
  const isAudio = computed(() => activeSource.value?.mediaType === 'audio')
  const canGoNext = computed(() => currentIndex.value < queue.value.length - 1)
  const canGoPrevious = computed(() => currentIndex.value > 0)
  const hasError = computed(() => !!error.value)
  const progress = computed(() => {
    if (!duration.value) return 0
    return currentTime.value / duration.value
  })
  
  // Helper functions
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  return {
    // MediaPlayer instance
    mediaPlayer: $mediaPlayer,
    
    // Reactive state (readonly to prevent direct mutations)
    state: readonly(state),
    
    // Computed properties
    isPlaying,
    isLoading,
    currentTrack,
    activeSource,
    currentTime,
    duration,
    volume,
    isMuted,
    currentIndex,
    queue,
    preferences,
    playbackState,
    error,
    
    // Computed helpers
    hasCurrentTrack,
    isVideo,
    isAudio,
    canGoNext,
    canGoPrevious,
    hasError,
    progress,
    formattedCurrentTime,
    formattedDuration,
    
    // Helper functions
    formatTime
  }
}

