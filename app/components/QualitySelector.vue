<script setup lang="ts">
import { computed, watch } from 'vue'
import { toRefs } from 'vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Settings, Check } from 'lucide-vue-next'
import type { MediaPlayer } from '~/lib/MediaPlayer'

// Define props with TypeScript
const props = defineProps<{
  mediaPlayer: MediaPlayer
}>()

// Use toRefs to maintain reactivity
const { mediaPlayer } = toRefs(props)

// Get reactive state from composable
const { state, activeSource } = useMediaPlayer()

// Computed properties for current state
const currentTrack = computed(() => state.value?.currentTrack)
const currentPreferences = computed(() => state.value?.preferences || { formats: [] })
const pluginOptions = computed(() => state.value?.pluginOptions || [])

// Get available sources for current track
const availableSources = computed(() => {
  if (!currentTrack.value?.sources) return []
  return currentTrack.value.sources
})

const hasHlsLevels = computed(() => 
  activeSource.value?.format === 'hls' && pluginOptions.value.length > 0
)

// Function to handle source selection with proper preference persistence
const handleSourceChange = (source: any) => {
  if (!mediaPlayer.value) return
  
  try {
    console.log('QualitySelector: User manually selected source:', source)
    
    // Get current track ID to ensure we're working with the right track
    const currentTrackId = currentTrack.value?.id
    if (!currentTrackId) {
      console.error('QualitySelector: No current track ID available')
      return
    }
    
    // Update format preferences to prioritize the selected format
    const selectedFormat = source.format
    const currentFormats = currentPreferences.value.formats || []
    
    // Move the selected format to the front of the preferences list
    const newFormats = [selectedFormat, ...currentFormats.filter(f => f !== selectedFormat)]
    
    // Update preferences in the MediaPlayer core
    const newPreferences = {
      ...currentPreferences.value,
      formats: newFormats
    }
    
    console.log('QualitySelector: Updating format preferences for persistence:', newFormats)
    mediaPlayer.value.setPreferences(newPreferences)
    
    // Important: Use setActiveSource instead of selectSource to avoid track confusion
    // This ensures we change the source for the current track without changing tracks
    mediaPlayer.value.setActiveSource(source)
    
    console.log('QualitySelector: Successfully changed source for track:', currentTrackId)
    
  } catch (error) {
    console.error('QualitySelector: Error selecting source:', error)
  }
}

const handlePluginOptionChange = (optionId: string) => {
  if (!mediaPlayer.value) return
  
  try {
    console.log('QualitySelector: Changing plugin option:', optionId)
    mediaPlayer.value.setPluginOption(optionId)
  } catch (error) {
    console.error('QualitySelector: Error changing plugin option:', error)
  }
}

// Format the quality label for display
const formatQualityLabel = (source: any) => {
  const format = source.format?.toUpperCase() || 'Unknown'
  const quality = source.quality || ''
  const mediaType = source.mediaType === 'video' ? '📹' : '🎵'
  
  return `${mediaType} ${format}${quality ? ` ${quality}` : ''}`
}

// Watch for changes in mediaPlayer to ensure we have the latest instance
watch(mediaPlayer, (newMediaPlayer) => {
  if (newMediaPlayer) {
    console.log('QualitySelector: MediaPlayer instance updated')
  }
}, { immediate: true })
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button 
        variant="ghost" 
        size="icon" 
        title="Quality & Source"
        :disabled="!availableSources.length"
      >
        <Settings class="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-[200px]">
      <DropdownMenuLabel>Source</DropdownMenuLabel>
      <DropdownMenuItem 
        v-for="source in availableSources" 
        :key="`${source.format}-${source.quality}-${source.src}`" 
        @click="handleSourceChange(source)"
        class="cursor-pointer"
      >
        <span class="flex-1">{{ formatQualityLabel(source) }}</span>
        <Check 
          v-if="activeSource?.src === source.src" 
          class="h-4 w-4 ml-2 text-primary" 
        />
      </DropdownMenuItem>
      
      <template v-if="hasHlsLevels">
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Quality (HLS)</DropdownMenuLabel>
        <DropdownMenuItem 
          v-for="option in pluginOptions" 
          :key="option.id" 
          @click="handlePluginOptionChange(option.id)"
          class="cursor-pointer"
        >
          <span class="flex-1">{{ option.label }}</span>
          <Check 
            v-if="state?.activePluginOptionId === option.id" 
            class="h-4 w-4 ml-2 text-primary" 
          />
        </DropdownMenuItem>
      </template>
      
      <!-- Show message if no sources available -->
      <DropdownMenuItem v-if="availableSources.length === 0" disabled>
        No sources available
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

