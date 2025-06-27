<script setup>
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Video, Music } from 'lucide-vue-next';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});

const { mediaPlayer } = toRefs(props);

// Get current state and preferences from media player
const currentState = computed(() => mediaPlayer.value?.getState?.() || {});
const currentPreferences = computed(() => currentState.value.preferences || { mediaType: ['video', 'audio'] });

// Determine current mode based on preferences order
const isVideoMode = computed(() => {
  const mediaTypes = currentPreferences.value.mediaType || ['video', 'audio'];
  return mediaTypes[0] === 'video';
});

// Toggle between video and audio mode
const toggleMediaType = () => {
  const currentMediaTypes = currentPreferences.value.mediaType || ['video', 'audio'];
  
  if (isVideoMode.value) {
    // Switch to audio mode: audio first, then video
    mediaPlayer.value.setPreferences({
      mediaType: ['audio', 'video']
    });
    console.log('MediaTypeSelector: Switched to audio mode');
  } else {
    // Switch to video mode: video first, then audio
    mediaPlayer.value.setPreferences({
      mediaType: ['video', 'audio']
    });
    console.log('MediaTypeSelector: Switched to video mode');
  }
};

// Get button text and icon
const buttonText = computed(() => {
  return isVideoMode.value ? 'Switch to Audio' : 'Switch to Video';
});

const buttonIcon = computed(() => {
  return isVideoMode.value ? Music : Video;
});
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

