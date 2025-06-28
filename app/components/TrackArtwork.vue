<script setup lang="ts">
import { Music } from 'lucide-vue-next'
import { cn } from '~/lib/utils'

interface Props {
  class?: string;
}

const props = defineProps<Props>();

const { isVideo, state } = useMediaPlayer();
</script>

<template>
  <div
    v-if="!isVideo"
    :class="cn('relative flex-shrink-0 w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden', props.class)"
  >
    <img
      v-if="state.currentTrack?.metadata?.artwork"
      :src="state.currentTrack?.metadata.artwork"
      :alt="state.currentTrack?.metadata.title"
      class="w-full h-full object-cover"
    >
    <Music v-else class="h-6 w-6 text-muted-foreground" />
  </div>
</template>