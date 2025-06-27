<template>
  <div
    ref="progressRef"
    :class="['relative group cursor-pointer', className]"
    @click="handleClick"
  >
    <Slider
      :model-value="[currentTime]"
      :max="duration"
      :step="0.1"
      :disabled="duration === 0"
      class="w-full"
      @update:model-value="handleSliderChange"
      @value-commit="handleSliderCommit"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Slider } from '@/components/ui/slider';

const props = defineProps({
  currentTime: { type: Number, required: true },
  duration: { type: Number, required: true },
  className: { type: String, default: '' },
});

const emit = defineEmits(['seek']);

const progressRef = ref(null);

const handleSliderChange = (value) => {
  // This is called during dragging - we could show a preview here
  // but we don't emit seek yet to avoid too many updates
};

const handleSliderCommit = (value) => {
  // This is called when the user releases the slider
  emit('seek', value[0]);
};

const handleClick = (e) => {
  if (!progressRef.value || props.duration === 0) return;
  
  // Calculate the time based on click position
  const rect = progressRef.value.getBoundingClientRect();
  const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const time = position * props.duration;
  
  emit('seek', time);
};
</script>