<script setup>
import { ref, computed, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Video, Music, ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['preferenceChanged']);

// Get current preferences from the media player
const currentPreferences = computed(() => props.mediaPlayer?.getState?.()?.preferences || { mediaType: ['video', 'audio'] });

// Determine current mode based on preferences
const currentMode = computed(() => {
  const mediaTypes = currentPreferences.value.mediaType;
  if (mediaTypes.includes('video') && mediaTypes.includes('audio')) {
    return 'video'; // Default to video when both are available
  } else if (mediaTypes.includes('video')) {
    return 'video';
  } else if (mediaTypes.includes('audio')) {
    return 'audio';
  }
  return 'video'; // Fallback
});

const selectedMode = ref(currentMode.value);

// Watch for changes in current mode and update selected mode
watch(currentMode, (newMode) => {
  selectedMode.value = newMode;
});

const handleModeChange = (mode) => {
  selectedMode.value = mode;
  
  // Update media player preferences
  const newPreferences = {
    ...currentPreferences.value,
    mediaType: mode === 'audio' ? ['audio'] : ['video', 'audio']
  };
  
  props.mediaPlayer.setPreferences(newPreferences);
  emit('preferenceChanged', mode);
  
  // Force reload current track with new preferences
  const state = props.mediaPlayer.getState();
  if (state.currentTrack && state.currentIndex >= 0) {
    // Find the best source with new preferences
    const track = state.currentTrack;
    const newMediaTypes = newPreferences.mediaType;
    const newFormats = newPreferences.formats;
    
    let bestSource = null;
    for (const mediaTypePref of newMediaTypes) {
      for (const formatPref of newFormats) {
        const source = track.sources.find(
          s => s.mediaType === mediaTypePref && s.format === formatPref
        );
        if (source) {
          bestSource = source;
          break;
        }
      }
      if (bestSource) break;
    }
    
    // If we found a different source, switch to it
    if (bestSource && bestSource.src !== state.activeSource?.src) {
      props.mediaPlayer.setActiveSource(bestSource);
    }
  }
};

const getModeIcon = (mode) => {
  return mode === 'video' ? Video : Music;
};

const getModeLabel = (mode) => {
  return mode === 'video' ? 'Video' : 'Audio Only';
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" :title="`Current mode: ${getModeLabel(selectedMode)}`">
        <component :is="getModeIcon(selectedMode)" class="h-5 w-5" />
        <ChevronDown class="h-3 w-3 ml-1" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-40">
      <DropdownMenuItem 
        @click="handleModeChange('video')"
        :class="{ 'bg-accent': selectedMode === 'video' }"
      >
        <Video class="h-4 w-4 mr-2" />
        Video
      </DropdownMenuItem>
      <DropdownMenuItem 
        @click="handleModeChange('audio')"
        :class="{ 'bg-accent': selectedMode === 'audio' }"
      >
        <Music class="h-4 w-4 mr-2" />
        Audio Only
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
