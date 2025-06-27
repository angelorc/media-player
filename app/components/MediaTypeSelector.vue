<script setup lang="ts">
import { computed } from 'vue'
import { toRefs } from 'vue'
import { Button } from '@/components/ui/button'
import { Video, Music } from 'lucide-vue-next'
import type { MediaPlayer } from '~/lib/MediaPlayer'

const { $mediaPlayer } = useNuxtApp()

// // Define props with TypeScript
// const props = defineProps<{
//   mediaPlayer: MediaPlayer
// }>()

// // Use toRefs to maintain reactivity
// const { mediaPlayer } = toRefs(props)

// Get reactive state from composable
const { state } = useMediaPlayer()

// Computed properties
const currentPreferences = computed(() => state.value?.preferences || { mediaType: ['video', 'audio'] })

// Determine current mode based on preferences order
const isVideoMode = computed(() => {
  const mediaTypes = currentPreferences.value.mediaType || ['video', 'audio']
  return mediaTypes[0] === 'video'
})

// Get button text and icon
const buttonText = computed(() => 
  isVideoMode.value ? 'Switch to Audio' : 'Switch to Video'
)

const buttonIcon = computed(() => 
  isVideoMode.value ? Music : Video
)

// Toggle between video and audio mode
const toggleMediaType = () => {
  if (!$mediaPlayer) return
  
  try {
    // const currentMediaTypes = currentPreferences.value.mediaType || ['video', 'audio']
    
    if (isVideoMode.value) {
      // Switch to audio mode: audio first, then video
      $mediaPlayer.setPreferences({
        ...currentPreferences.value,
        mediaType: ['audio', 'video'],
        formats: [...(currentPreferences.value.formats || [])]
      })
      console.log('MediaTypeSelector: Switched to audio mode')
    } else {
      // Switch to video mode: video first, then audio
      $mediaPlayer.setPreferences({
        ...currentPreferences.value,
        mediaType: ['video', 'audio'],
        formats: Array.from(currentPreferences.value.formats || [])
      })
      console.log('MediaTypeSelector: Switched to video mode')
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
    :title="buttonText"
    class="flex items-center gap-2"
  >
    <component :is="buttonIcon" class="h-4 w-4" />
    <span class="hidden sm:inline">{{ buttonText }}</span>
  </Button>
</template>

