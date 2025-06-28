<script setup lang="ts">
import { useMediaPlayer } from '@/composables/useMediaPlayer';

interface Props {
  artworkClass?: string;
}

const props = defineProps<Props>();

const { state, hasCurrentTrack } = useMediaPlayer();
</script>

<template>
  <div v-if="!hasCurrentTrack" class="flex-1 min-w-0" />
  <div v-else class="flex items-center gap-3 min-w-0 flex-1">
    <TrackArtwork :class="props.artworkClass" />
    
    <div class="min-w-0">
      <div class="font-medium text-sm truncate">{{ state.currentTrack?.metadata?.title || 'Unknown Track' }}</div>
      <div class="text-muted-foreground text-xs truncate">{{ state.currentTrack?.metadata?.artist || 'Unknown Artist' }}</div>
    </div>
  </div>
</template>
