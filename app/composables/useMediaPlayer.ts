import type { PlayerState, Subscription } from '~/lib/types'

export function useMediaPlayer() {
  const { $mediaPlayer } = useNuxtApp()
  
  if (!$mediaPlayer) {
    throw new Error('MediaPlayer plugin not found. Make sure the plugin is properly configured.')
  }

  const state = useState<PlayerState>(() => $mediaPlayer.getState())
  
  let subscription: Subscription | null = null
  
  try {
    subscription = $mediaPlayer.subscribe((newState: PlayerState) => {
      state.value = newState
    })
  } catch (error) {
    console.error('useMediaPlayer: Failed to subscribe to MediaPlayer state:', error)
  }
  
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

  const isSeeking = useState(() => false)
  const scrubTime = useState(() => 0)

  watch(currentTime, (newPlayerTime) => {
    if (isSeeking.value) {
      if (Math.abs(newPlayerTime - scrubTime.value) < 0.5) {
        isSeeking.value = false
      }
    }
  })

  const sliderPosition = computed<number[]>({
    get() {
      const timeSource = isSeeking.value ? scrubTime.value : currentTime.value
      if (!duration.value || isNaN(duration.value) || duration.value === 0) {
        return [0]
      }
      return [(timeSource / duration.value) * 100]
    },
    set(value: number[]) {
      if (!duration.value) return
      isSeeking.value = true
      scrubTime.value = ((value[0] || 0) / 100) * duration.value
    }
  })

  const onSeekCommit = (value: number[]) => {
    if (!duration.value) return
    const finalTime = ((value[0] || 0) / 100) * duration.value
    $mediaPlayer.seek(finalTime)
  }

  const displayTime = computed<number>(() => {
    if (isSeeking.value) {
      return scrubTime.value
    }
    return currentTime.value
  })

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))
  const formattedDisplayTime = computed(() => formatTime(displayTime.value))

  return {
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
    formattedDisplayTime,
    
    // Helper functions
    formatTime,

    isSeeking,
    scrubTime,
    sliderPosition,
    displayTime,
    onSeekCommit,
  }
}

