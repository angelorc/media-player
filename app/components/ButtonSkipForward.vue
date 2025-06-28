<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { SkipForward } from 'lucide-vue-next'

const { $mediaPlayer } = useNuxtApp()
const { canGoNext } = useMediaPlayer()
</script>

<template>
  <Button 
    variant="ghost" 
    size="icon" 
    :disabled="!canGoNext" 
    title="Next" 
    @click="$mediaPlayer.next()"
  >
    <SkipForward class="h-5 w-5" />
  </Button>
</template>