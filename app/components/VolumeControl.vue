<template>
  <div
    class="flex items-center gap-2 group"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <Button variant="ghost" size="icon" @click="emit('toggleMute')" :title="isMuted ? 'Unmute' : 'Mute'">
      <component :is="volumeIcon" class="h-5 w-5" />
    </Button>
    <!-- The container for the volume slider -->
    <div
      ref="volumeRef"
      class="relative h-1 bg-muted rounded-full cursor-pointer transition-all duration-200"
      :class="{ 'w-20': isHovered || isDragging, 'w-0': !isHovered && !isDragging }"
      @mousedown="handleMouseDown"
    >
      <!-- The colored-in part of the volume slider -->
      <div
        class="absolute left-0 top-0 h-full bg-foreground rounded-full"
        :style="{ width: `${displayVolume * 100}%` }"
      />
      <!-- The draggable handle for the volume -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full shadow-lg transition-opacity"
        :class="{ 'opacity-100': isHovered || isDragging, 'opacity-0': !isHovered && !isDragging }"
        :style="{
          left: `${displayVolume * 100}%`,
          transform: 'translateX(-50%) translateY(-50%)',
        }"
      />
    </div>
  </div>
</template>

<script setup>
// The script block for this component also remains the same.
import { ref, computed, watch, onUnmounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Volume1 } from 'lucide-vue-next';

const props = defineProps({
  volume: { type: Number, required: true },
  isMuted: { type: Boolean, required: true },
});

const emit = defineEmits(['volumeChange', 'toggleMute']);

const isHovered = ref(false);
const isDragging = ref(false);
const volumeRef = ref(null);

const displayVolume = computed(() => (props.isMuted ? 0 : props.volume));

const volumeIcon = computed(() => {
  if (props.isMuted || props.volume === 0) return VolumeX;
  if (props.volume < 0.5) return Volume1;
  return Volume2;
});

const getVolumeFromPosition = (clientX) => {
  if (!volumeRef.value) return 0;
  const rect = volumeRef.value.getBoundingClientRect();
  const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return position;
};

const handleVolumeChange = (clientX) => {
  const newVolume = getVolumeFromPosition(clientX);
  emit('volumeChange', newVolume);
};

const handleMouseDown = (e) => {
  e.preventDefault(); // Prevents text selection while dragging
  isDragging.value = true;
  handleVolumeChange(e.clientX);
};

const handleMouseMove = (e) => {
  if (isDragging.value) {
    handleVolumeChange(e.clientX);
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
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