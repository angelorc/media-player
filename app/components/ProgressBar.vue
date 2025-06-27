<template>
  <div
    ref="progressRef"
    :class="['relative h-5 group cursor-pointer', className]"
    @mousedown="handleMouseDown"
    @click="handleClick"
  >
    <!-- The background track of the progress bar -->
    <div
      :class="[
        'absolute w-full top-1/2 -translate-y-1/2 bg-muted rounded-full transition-all duration-200',
        'h-1 group-hover:h-1.5', // Expands on hover
      ]"
    >
      <!-- The colored-in part of the progress bar -->
      <div
        class="h-full bg-primary rounded-full"
        :style="{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }"
      />
      <!-- The draggable handle -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg transition-opacity"
        :class="{
          'opacity-100': isDragging, // Always show when dragging
          'opacity-0 group-hover:opacity-100': !isDragging, // Otherwise, show only on hover
        }"
        :style="{
          left: `${Math.max(0, Math.min(100, progress * 100))}%`,
          transform: 'translateX(-50%) translateY(-50%)',
        }"
      />
    </div>
  </div>
</template>

<script setup>
// The script block remains the same as it was already correct.
import { ref, computed, onUnmounted, watch } from 'vue';

const props = defineProps({
  currentTime: { type: Number, required: true },
  duration: { type: Number, required: true },
  className: { type: String, default: '' },
});

const emit = defineEmits(['seek']);

const progressRef = ref(null);
const isDragging = ref(false);
const dragTime = ref(0);

const progress = computed(() => {
  if (props.duration > 0) {
    return (isDragging.value ? dragTime.value : props.currentTime) / props.duration;
  }
  return 0;
});

const getTimeFromPosition = (clientX) => {
  if (!progressRef.value || props.duration === 0) return 0;
  const rect = progressRef.value.getBoundingClientRect();
  const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return position * props.duration;
};

const handleSeek = (clientX) => {
  const time = getTimeFromPosition(clientX);
  emit('seek', time);
};

const handleMouseDown = (e) => {
  isDragging.value = true;
  dragTime.value = getTimeFromPosition(e.clientX);
};

const handleMouseMove = (e) => {
  if (isDragging.value) {
    dragTime.value = getTimeFromPosition(e.clientX);
  }
};

const handleMouseUp = (e) => {
  if (isDragging.value) {
    isDragging.value = false;
    handleSeek(e.clientX);
  }
};

const handleClick = (e) => {
  if (!isDragging.value) {
    handleSeek(e.clientX);
  }
};

watch(isDragging, (dragging) => {
  if (dragging) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  } else {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
});

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});
</script>