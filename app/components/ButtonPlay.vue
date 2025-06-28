<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Play, Pause, Loader2 } from 'lucide-vue-next'

const { $mediaPlayer } = useNuxtApp()

const { 
  state, 
  isPlaying, 
  isLoading, 
} = useMediaPlayer()
</script>

<template>
  <Button
    variant="default"
    size="icon"
    :disabled="state.playbackState === 'ERROR'"
    class="w-10 h-10 rounded-full"
    :title="isPlaying ? 'Pause' : 'Play'"
    @click="() => (isPlaying ? $mediaPlayer.pause() : $mediaPlayer.play())"
  >
    <Loader2 v-if="isLoading" class="h-5 w-5 animate-spin" />
    <Pause v-else-if="isPlaying" class="h-5 w-5" />
    <Play v-else class="h-5 w-5" />
  </Button>
</template>