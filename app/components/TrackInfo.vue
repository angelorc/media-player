<template>
  <div v-if="!hasCurrentTrack" class="flex-1 min-w-0" />
  <div v-else class="flex items-center gap-3 min-w-0 flex-1">
    <!-- Artwork container (only for audio tracks or when no video thumbnail is shown) -->
    <div
      v-if="!isVideo"
      class="relative flex-shrink-0 w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden"
    >
      <img
        v-if="state.currentTrack.metadata?.artwork"
        :src="state.currentTrack.metadata.artwork || '/placeholder.svg'"
        :alt="state.currentTrack.metadata.title || 'Track artwork'"
        class="w-full h-full object-cover"
      />
      <Music v-else class="h-6 w-6 text-muted-foreground" />
    </div>
    
    <!-- Track metadata -->
    <div class="min-w-0">
      <div class="font-medium text-sm truncate">{{ state.currentTrack.metadata?.title || 'Unknown Track' }}</div>
      <div class="text-muted-foreground text-xs truncate">{{ state.currentTrack.metadata?.artist || 'Unknown Artist' }}</div>
    </div>
  </div>
</template>

<script setup>
import { useMediaPlayer } from '@/composables/useMediaPlayer';
import { Music } from 'lucide-vue-next';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});

const { mediaPlayer } = toRefs(props);

const { state, isVideo, hasCurrentTrack } = useMediaPlayer(mediaPlayer.value);
</script>