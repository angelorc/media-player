<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Video, Music } from 'lucide-vue-next'

const { $mediaPlayer } = useNuxtApp()

const { state } = useMediaPlayer()

const currentPreferences = computed(() => state.value?.preferences || { mediaType: ['video', 'audio'] })

const isVideoMode = computed(() => {
  const mediaTypes = currentPreferences.value.mediaType || ['video', 'audio']
  return mediaTypes[0] === 'video'
})

const buttonText = computed(() => 
  isVideoMode.value ? 'Switch to Audio' : 'Switch to Video'
)

const buttonIcon = computed(() => 
  isVideoMode.value ? Music : Video
)

const hasVideoSource = computed(() => state.value.currentTrack?.sources?.some(source => source.mediaType === 'video'))

const toggleMediaType = () => {
  if (!$mediaPlayer) return
  
  try {
    if (isVideoMode.value) {
      $mediaPlayer.setPlaybackType('audio')
    } else {
      $mediaPlayer.setPlaybackType('video')
    }
  } catch (error) {
    console.error('MediaTypeSelector: Error toggling media type:', error)
  }
}
</script>

<template>
  <Button 
    variant="ghost" 
    size="sm" 
    @click="toggleMediaType"
    class="flex items-center gap-2"
    :aria-label="buttonText"
    :title="buttonText"
    :disabled="!hasVideoSource && isVideoMode"
  >
    <component :is="buttonIcon" class="h-4 w-4" />
  </Button>
</template>

