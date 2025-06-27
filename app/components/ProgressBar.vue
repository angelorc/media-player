<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toRefs, withDefaults } from 'vue'
import { Slider } from '@/components/ui/slider'

// Define props with TypeScript and defaults
const props = withDefaults(defineProps<{
  currentTime: number
  duration: number
  isLoading?: boolean
}>(), {
  currentTime: 0,
  duration: 0,
  isLoading: false
})

// Use toRefs to maintain reactivity
const { currentTime, duration, isLoading } = toRefs(props)

// Define emits
const emit = defineEmits<{
  seek: [time: number]
}>()

// Seeking state management (following user's example)
const isSeeking = ref(false)
const scrubTime = ref(0)

// Slider position computed property with get/set
const sliderPosition = computed<number[]>({
  get() {
    const timeSource = isSeeking.value ? scrubTime.value : currentTime.value
    if (!duration.value || isNaN(duration.value) || duration.value === 0) {
      return [0]
    }
    return [(timeSource / duration.value) * 100]
  },
  set(value: number[]) {
    if (!duration.value) return
    isSeeking.value = true
    scrubTime.value = ((value[0] || 0) / 100) * duration.value
  }
})

// Handle seek commit when user releases the slider
const onSeekCommit = (value: number[]) => {
  if (!duration.value) return
  const finalTime = ((value[0] || 0) / 100) * duration.value
  emit('seek', finalTime)
}

// Watch for currentTime changes to reset seeking state
watch(currentTime, (newPlayerTime) => {
  if (isSeeking.value) {
    if (Math.abs(newPlayerTime - scrubTime.value) < 0.5) {
      isSeeking.value = false
    }
  }
})

// Display time computed property
const displayTime = computed<number>(() => {
  if (isSeeking.value) {
    return scrubTime.value
  }
  return currentTime.value
})

// Helper function to format time
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}
</script>

<template>
  <div class="flex items-center gap-2 w-full">
    <span class="text-xs text-muted-foreground tabular-nums min-w-[35px] text-right">
      {{ formatTime(displayTime) }}
    </span>
    <Slider
      v-model:model-value="sliderPosition"
      :max="100"
      :step="0.1"
      class="flex-1 h-1 cursor-pointer"
      :disabled="!duration || isLoading"
      @value-commit="onSeekCommit"
    />
    <span class="text-xs text-muted-foreground tabular-nums min-w-[35px] text-left">
      {{ formatTime(duration) }}
    </span>
  </div>
</template>