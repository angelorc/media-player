<template>
  <div
    class="flex items-center gap-2 group"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <Button variant="ghost" size="icon" @click="emit('toggleMute')" :title="isMuted ? 'Unmute' : 'Mute'">
      <component :is="volumeIcon" class="h-5 w-5" />
    </Button>
    
    <!-- Volume slider container -->
    <div
      class="relative transition-all duration-200 overflow-hidden"
      :class="{ 'w-20': isHovered || isDragging, 'w-0': !isHovered && !isDragging }"
    >
      <Slider
        :model-value="[displayVolume * 100]"
        :max="100"
        :step="1"
        :disabled="isMuted"
        class="w-full"
        @update:model-value="handleVolumeChange"
        @value-commit="handleVolumeCommit"
        @mousedown="isDragging = true"
        @mouseup="isDragging = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, Volume1 } from 'lucide-vue-next';

const props = defineProps({
  volume: { type: Number, required: true },
  isMuted: { type: Boolean, required: true },
});

const emit = defineEmits(['volumeChange', 'toggleMute']);

const isHovered = ref(false);
const isDragging = ref(false);

const displayVolume = computed(() => (props.isMuted ? 0 : props.volume));

const volumeIcon = computed(() => {
  if (props.isMuted || props.volume === 0) return VolumeX;
  if (props.volume < 0.5) return Volume1;
  return Volume2;
});

const handleVolumeChange = (value) => {
  // Convert from 0-100 to 0-1 range
  const newVolume = value[0] / 100;
  emit('volumeChange', newVolume);
};

const handleVolumeCommit = (value) => {
  // This is called when the user releases the slider
  const newVolume = value[0] / 100;
  emit('volumeChange', newVolume);
  isDragging.value = false;
};
</script>