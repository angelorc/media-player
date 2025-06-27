<template>
  <div class="flex items-center gap-2 w-full">
    <!-- <span class="text-xs text-muted-foreground tabular-nums min-w-[35px] text-right">
      {{ formatTime(displayTime) }}
    </span> -->
    <Slider
      v-model:model-value="sliderPosition"
      :max="100"
      :step="0.1"
      class="flex-1 h-1 cursor-pointer"
      :disabled="!duration || isLoading"
      @value-commit="onSeekCommit"
    />
    <!-- <span class="text-xs text-muted-foreground tabular-nums min-w-[35px] text-left">
      {{ formatTime(duration) }}
    </span> -->
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Slider } from '@/components/ui/slider';

const props = defineProps({
  currentTime: { type: Number, required: true },
  duration: { type: Number, required: true },
  isLoading: { type: Boolean, default: false },
});

const { currentTime, duration, isLoading } = toRefs(props);

const emit = defineEmits(['seek']);

const isSeeking = ref(false);
const scrubTime = ref(0);

const sliderPosition = computed({
  get() {
    const timeSource = isSeeking.value ? scrubTime.value : currentTime.value;
    if (!duration.value || isNaN(duration.value) || duration.value === 0) {
      return [0];
    }
    return [(timeSource / duration.value) * 100];
  },
  set(value) {
    if (!duration.value) return;
    isSeeking.value = true;
    scrubTime.value = ((value[0] || 0) / 100) * duration.value;
  },
});

const onSeekCommit = (value) => {
  if (!duration.value) return;
  const finalTime = ((value[0] || 0) / 100) * duration.value;
  emit('seek', finalTime);
};

watch(() => currentTime, (newPlayerTime) => {
  if (isSeeking.value) {
    if (Math.abs(newPlayerTime - scrubTime.value) < 0.5) {
      isSeeking.value = false;
    }
  }
});

const displayTime = computed(() => {
  if (isSeeking.value) {
    return scrubTime.value;
  }
  return props.currentTime;
});

// Format time in MM:SS or HH:MM:SS format
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
};
</script>