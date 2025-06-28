<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { SkipBack } from 'lucide-vue-next'

const { $mediaPlayer } = useNuxtApp()
const { canGoPrevious } = useMediaPlayer()
</script>

<template>
  <Button 
    variant="ghost" 
    size="icon" 
    :disabled="!canGoPrevious" 
    title="Previous" 
    @click="$mediaPlayer.previous()"
  >
    <SkipBack class="h-5 w-5" />
  </Button>
</template>