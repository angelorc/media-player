<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, Volume1 } from 'lucide-vue-next';
import { useElementHover } from '@vueuse/core'

const { $mediaPlayer } = useNuxtApp();
const { volume, isMuted } = useMediaPlayer();

const volumeControlRef = useTemplateRef<HTMLDivElement>('volumeControl')
const isHovered = useElementHover(volumeControlRef)

// const isHovered = ref(false);
const isDragging = ref(false);

const displayVolume = computed(() => (isMuted.value ? 0 : volume.value));

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) return VolumeX;
  if (volume.value < 0.5) return Volume1;
  return Volume2;
});

const handleVolumeChange = (value) => {
  const newVolume = value[0] / 100;
  $mediaPlayer.setVolume(newVolume)
};

const handleVolumeCommit = (value) => {
  const newVolume = value[0] / 100;
  $mediaPlayer.setVolume(newVolume)
  isDragging.value = false;
};
</script>

<template>
  <div
    ref="volumeControl"
    class="flex items-center gap-2 group"
  >
    <Button variant="ghost" size="icon" :title="isMuted ? 'Unmute' : 'Mute'" @click="$mediaPlayer.toggleMute">
      <component :is="volumeIcon" class="h-5 w-5" />
    </Button>
    
    <div
      class="relative transition-all duration-200 overflow-hidden"
      :class="{ 'w-20': isHovered || isDragging, 'w-0': !isHovered && !isDragging }"
    >
      <Slider
        :model-value="[displayVolume * 100]"
        :max="100"
        :step="1"
        :disabled="isMuted"
        class="w-full cursor-pointer"
        @update:model-value="handleVolumeChange"
        @value-commit="handleVolumeCommit"
        @mousedown="isDragging = true"
        @mouseup="isDragging = false"
      />
    </div>
  </div>
</template>
