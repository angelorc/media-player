<script setup lang="ts">
import { Slider } from '@/components/ui/slider'

const {
  duration,
  isLoading,
  sliderPosition,
  onSeekCommit
} = useMediaPlayer()
</script>

<template>
  <Slider
    v-model:model-value="sliderPosition"
    :max="100"
    :step="0.1"
    :disabled="!duration || isLoading"
    @value-commit="onSeekCommit"
  />
</template>