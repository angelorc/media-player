<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Play, Pause, Loader2 } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const { $mediaPlayer } = useNuxtApp()

const { 
  state, 
  isPlaying, 
  isLoading, 
} = useMediaPlayer()

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <Button
    variant="default"
    size="icon"
    :disabled="state.playbackState === 'ERROR'"
    :class="cn('w-10 h-10 rounded-full', props.class)"
    :title="isPlaying ? 'Pause' : 'Play'"
    @click="() => (isPlaying ? $mediaPlayer.pause() : $mediaPlayer.play())"
  >
    <Loader2 v-if="isLoading" class="h-5 w-5 animate-spin" />
    <Pause v-else-if="isPlaying" fill="currentColor" class="h-5 w-5" />
    <Play v-else class="h-5 w-5" fill="currentColor" />
  </Button>
</template>