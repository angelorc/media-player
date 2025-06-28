<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

const breakpoints = useBreakpoints(breakpointsTailwind)

const { $mediaPlayer } = useNuxtApp()

const { 
  state, 
  hasError, 
  isVideo, 
  hasCurrentTrack, 
} = useMediaPlayer()

// Local reactive state
const displayMode = ref<'normal' | 'pip' | 'fullscreen'>('normal')

// Event handlers
const handleToggleFullscreen = async () => {
  if (!$mediaPlayer) return
  
  const videoElement = $mediaPlayer.getActiveHTMLElement()
  if (videoElement && videoElement instanceof HTMLVideoElement) {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await videoElement.requestFullscreen()
      }
    } catch (error) {
      console.error("PlayerControls: Fullscreen error:", error)
    }
  }
}

const handleTogglePip = async () => {
  if (!$mediaPlayer) return
  
  const videoElement = $mediaPlayer.getActiveHTMLElement()
  if (videoElement && videoElement instanceof HTMLVideoElement) {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoElement.requestPictureInPicture()
      }
    } catch (error) {
      console.error("PlayerControls: PiP error:", error)
    }
  }
}

// Event listeners
const onFullscreenChange = () => {
  displayMode.value = document.fullscreenElement ? 'fullscreen' : 'normal'
}

const onPipChange = () => {
  displayMode.value = document.pictureInPictureElement ? 'pip' : 'normal'
}

const setupEventListeners = () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  
  if ($mediaPlayer) {
    const videoEl = $mediaPlayer.getActiveHTMLElement()
    if (videoEl) {
      videoEl.addEventListener('enterpictureinpicture', onPipChange)
      videoEl.addEventListener('leavepictureinpicture', onPipChange)
    }
  }
}

const cleanupEventListeners = () => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  
  if ($mediaPlayer) {
    const videoEl = $mediaPlayer.getActiveHTMLElement()
    if (videoEl) {
      videoEl.removeEventListener('enterpictureinpicture', onPipChange)
      videoEl.removeEventListener('leavepictureinpicture', onPipChange)
    }
  }
}

onMounted(setupEventListeners)
onUnmounted(cleanupEventListeners)

// Watch for active source changes to update event listeners
watch(() => state.value?.activeSource?.src, () => {
  cleanupEventListeners()
  setupEventListeners()
})

const isMobile = computed(() => breakpoints.isSmallerOrEqual('sm'))

const isMobileExpanded = ref(false)
</script>

<template>
  <div v-if="!isMobile && hasCurrentTrack" class="fixed bottom-0 left-0 right-0 z-50">
    <div class="relative w-full border-t bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <ProgressBar class="absolute -top-1 left-0 right-0 h-1" />
      
      <div class="flex items-center justify-between px-4 py-2 gap-4">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <VideoThumbnail
            v-if="isVideo"
            :display-mode="displayMode"
            class="flex-shrink-0"
            @toggle-pip="handleTogglePip"
            @toggle-fullscreen="handleToggleFullscreen"
          />
          
          <TrackInfo class="min-w-0" />
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <ButtonSkipBack />
          <ButtonPlay />
          <ButtonSkipForward />
        </div>

        <div class="flex items-center gap-2 flex-1 justify-end">
          <TimeDisplay />
          <VolumeControl />
          <MediaTypeSelector />
          <QualitySelector />
          <Queue />
        </div>
      </div>
      
      <div v-if="hasError" class="text-xs text-destructive bg-destructive/10 p-2 mx-4 mb-2 rounded-md border border-destructive/20">
        Error: {{ state.error }}
      </div>
    </div>
  </div>
  <div v-if="isMobile">
    <MobileControls v-model="isMobileExpanded" />
    <MobileExpanded v-model="isMobileExpanded" />
  </div>
</template>

