<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toRefs } from 'vue'
import { Button } from '@/components/ui/button'
import { Play, Pause, SkipBack, SkipForward, Loader2 } from 'lucide-vue-next'
import VideoDisplay from './VideoDisplay.vue'
import VideoThumbnail from './VideoThumbnail.vue'
import ProgressBar from './ProgressBar.vue'
import VolumeControl from './VolumeControl.vue'
import QualitySelector from './QualitySelector.vue'
import MediaTypeSelector from './MediaTypeSelector.vue'
import TrackInfo from './TrackInfo.vue'
import TimeDisplay from './TimeDisplay.vue'
import type { MediaPlayer } from '~/lib/MediaPlayer'

// Define props with TypeScript
const props = defineProps<{
  mediaPlayer: MediaPlayer
}>()

// Use toRefs to maintain reactivity
const { mediaPlayer } = toRefs(props)

// Get reactive state from composable
const { 
  state, 
  isPlaying, 
  isLoading, 
  hasError, 
  isVideo, 
  hasCurrentTrack, 
  canGoNext, 
  canGoPrevious 
} = useMediaPlayer()

// Local reactive state
const displayMode = ref<'normal' | 'pip' | 'fullscreen'>('normal')

// Event handlers
const handleToggleFullscreen = async () => {
  if (!mediaPlayer.value) return
  
  const videoElement = mediaPlayer.value.getActiveHTMLElement()
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
  if (!mediaPlayer.value) return
  
  const videoElement = mediaPlayer.value.getActiveHTMLElement()
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
  
  if (mediaPlayer.value) {
    const videoEl = mediaPlayer.value.getActiveHTMLElement()
    if (videoEl) {
      videoEl.addEventListener('enterpictureinpicture', onPipChange)
      videoEl.addEventListener('leavepictureinpicture', onPipChange)
    }
  }
}

const cleanupEventListeners = () => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  
  if (mediaPlayer.value) {
    const videoEl = mediaPlayer.value.getActiveHTMLElement()
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
</script>

<template>
  <div v-if="hasCurrentTrack" class="fixed bottom-0 left-0 right-0 z-50">
    <div class="relative w-full border-t bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <!-- Progress Bar -->
      <ProgressBar
        :current-time="state.currentTime"
        :duration="state.duration"
        :is-loading="state.isLoading"
        @seek="(time: number) => mediaPlayer.seek(time)"
        class="absolute -top-1 left-0 right-0 h-1"
      />
      
      <div class="flex items-center justify-between px-4 py-2 gap-4">
        <!-- Left section: Video Thumbnail + Track Info -->
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <!-- Video Thumbnail (only shown for video content) -->
          <VideoThumbnail
            v-if="isVideo"
            :media-player="mediaPlayer"
            :display-mode="displayMode"
            @toggle-pip="handleTogglePip"
            @toggle-fullscreen="handleToggleFullscreen"
            class="flex-shrink-0"
          />
          
          <!-- Track Info -->
          <TrackInfo :media-player="mediaPlayer" class="min-w-0" />
        </div>

        <!-- Center section: Playback Controls -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            @click="mediaPlayer.previous()" 
            :disabled="!canGoPrevious" 
            title="Previous"
          >
            <SkipBack class="h-5 w-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            @click="() => (isPlaying ? mediaPlayer.pause() : mediaPlayer.play())"
            :disabled="state.playbackState === 'ERROR'"
            class="w-10 h-10 rounded-full"
            :title="isPlaying ? 'Pause' : 'Play'"
          >
            <Loader2 v-if="isLoading" class="h-5 w-5 animate-spin" />
            <Pause v-else-if="isPlaying" class="h-5 w-5" />
            <Play v-else class="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            @click="mediaPlayer.next()" 
            :disabled="!canGoNext" 
            title="Next"
          >
            <SkipForward class="h-5 w-5" />
          </Button>
        </div>

        <!-- Right section: Additional Controls -->
        <div class="flex items-center gap-2 flex-1 justify-end">
          <TimeDisplay 
            :current-time="state.currentTime" 
            :duration="state.duration" 
          />
          <VolumeControl
            :volume="state.volume"
            :is-muted="state.isMuted"
            @volume-change="(volume: number) => mediaPlayer.setVolume(volume)"
            @toggle-mute="mediaPlayer.toggleMute"
          />
          <!-- Media Type Selector -->
          <MediaTypeSelector 
            :media-player="mediaPlayer"
          />
          <!-- Video Display Controls (only for video content and when not in normal mode) -->
          <!-- <VideoDisplay
            v-if="isVideo && displayMode !== 'normal'"
            :display-mode="displayMode"
            @toggle-pip="handleTogglePip"
            @toggle-fullscreen="handleToggleFullscreen"
          /> -->
          <QualitySelector
            :media-player="mediaPlayer"
          />
        </div>
      </div>
      
      <!-- Error Display -->
      <div v-if="hasError" class="text-xs text-destructive bg-destructive/10 p-2 mx-4 mb-2 rounded-md border border-destructive/20">
        Error: {{ state.error }}
      </div>
    </div>
  </div>
</template>

