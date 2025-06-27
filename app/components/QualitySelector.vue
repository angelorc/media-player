<script setup>
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Check } from 'lucide-vue-next';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});

const { mediaPlayer } = toRefs(props);

// Get current state from media player
const currentState = computed(() => mediaPlayer.value?.getState?.() || {});
const currentTrack = computed(() => currentState.value.currentTrack);
const activeSource = computed(() => currentState.value.activeSource);
const pluginOptions = computed(() => currentState.value.pluginOptions || []);
const currentPreferences = computed(() => currentState.value.preferences || { formats: [] });

// Get available sources for current track
const availableSources = computed(() => {
  if (!currentTrack.value?.sources) return [];
  return currentTrack.value.sources;
});

const hasHlsLevels = computed(() => activeSource.value?.format === 'hls' && pluginOptions.value.length > 0);

const handleSourceChange = (source) => {
  console.log('QualitySelector: User manually selected source:', source);
  
  // Update format preferences to prioritize the selected format
  const selectedFormat = source.format;
  const currentFormats = currentPreferences.value.formats || [];
  
  // Move the selected format to the front of the preferences list
  const newFormats = [selectedFormat, ...currentFormats.filter(f => f !== selectedFormat)];
  
  // Update preferences in the MediaPlayer core
  const newPreferences = {
    ...currentPreferences.value,
    formats: newFormats
  };
  
  console.log('QualitySelector: Updating format preferences for persistence:', newFormats);
  mediaPlayer.value.setPreferences(newPreferences);
  
  // Change to the selected source
  mediaPlayer.value.setActiveSource(source);
};

const handlePluginOptionChange = (optionId) => {
  console.log('QualitySelector: Changing plugin option:', optionId);
  mediaPlayer.value.setPluginOption(optionId);
};

// Format the quality label for display
const formatQualityLabel = (source) => {
  return source.quality || `${source.format.toUpperCase()} (${source.mediaType})`;
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" title="Quality & Source">
        <Settings class="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-[200px]">
      <DropdownMenuLabel>Source</DropdownMenuLabel>
      <DropdownMenuItem 
        v-for="source in availableSources" 
        :key="source.src" 
        @click="handleSourceChange(source)"
      >
        <span class="flex-1">{{ formatQualityLabel(source) }}</span>
        <Check v-if="activeSource?.src === source.src" class="h-4 w-4 ml-2" />
      </DropdownMenuItem>
      <template v-if="hasHlsLevels">
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Quality (HLS)</DropdownMenuLabel>
        <DropdownMenuItem 
          v-for="option in pluginOptions" 
          :key="option.id" 
          @click="handlePluginOptionChange(option.id)"
        >
          <span class="flex-1">{{ option.label }}</span>
          <Check v-if="currentState.activePluginOptionId === option.id" class="h-4 w-4 ml-2" />
        </DropdownMenuItem>
      </template>
      
      <!-- Show message if no sources available -->
      <DropdownMenuItem v-if="availableSources.length === 0" disabled>
        No sources available
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

