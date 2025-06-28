<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Settings, Check } from 'lucide-vue-next'

const { $mediaPlayer } = useNuxtApp()

const { state, activeSource } = useMediaPlayer()

const currentTrack = computed(() => state.value?.currentTrack)
const currentPreferences = computed(() => state.value?.preferences || { formats: [] })
const pluginOptions = computed(() => state.value?.pluginOptions || [])

const availableSources = computed(() => {
  if (!currentTrack.value?.sources) return []
  return currentTrack.value.sources
})

const hasHlsLevels = computed(() => 
  activeSource.value?.format === 'hls' && pluginOptions.value.length > 0
)

const handleSourceChange = (source: any) => {
  if (!$mediaPlayer) return
  
  try {
    console.log('QualitySelector: User manually selected source:', source)
    
    const currentTrackId = currentTrack.value?.id
    if (!currentTrackId) {
      console.error('QualitySelector: No current track ID available')
      return
    }
    
    const selectedFormat = source.format
    const currentFormats = currentPreferences.value.formats || []
    
    const newFormats = [selectedFormat, ...currentFormats.filter(f => f !== selectedFormat)]
    
    const newPreferences = {
      ...currentPreferences.value,
      formats: newFormats
    }
    
    console.log('QualitySelector: Updating format preferences for persistence:', newFormats)
    $mediaPlayer.setPreferences(newPreferences)
    
    $mediaPlayer.setActiveSource(source)
    
    console.log('QualitySelector: Successfully changed source for track:', currentTrackId)
    
  } catch (error) {
    console.error('QualitySelector: Error selecting source:', error)
  }
}

const handlePluginOptionChange = (optionId: string) => {
  if (!$mediaPlayer) return
  
  try {
    console.log('QualitySelector: Changing plugin option:', optionId)
    $mediaPlayer.setPluginOption(optionId)
  } catch (error) {
    console.error('QualitySelector: Error changing plugin option:', error)
  }
}

const formatQualityLabel = (source: any) => {
  const format = source.format?.toUpperCase() || 'Unknown'
  const quality = source.quality || ''
  const mediaType = source.mediaType === 'video' ? '📹' : '🎵'
  
  return `${mediaType} ${format}${quality ? ` ${quality}` : ''}`
}

watch($mediaPlayer, (newMediaPlayer) => {
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
      
      <DropdownMenuItem v-if="availableSources.length === 0" disabled>
        No sources available
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

