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

const toggleMediaType = () => {
  if (!$mediaPlayer) return
  
  try {
    if (isVideoMode.value) {
      $mediaPlayer.setPreferences({
        ...currentPreferences.value,
        mediaType: ['audio', 'video'],
        formats: [...(currentPreferences.value.formats || [])]
      })
      console.log('MediaTypeSelector: Switched to audio mode')
    } else {
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

