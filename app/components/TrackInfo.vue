<script setup lang="ts">
import { useMediaPlayer } from '@/composables/useMediaPlayer';
import { useSwipe } from '@vueuse/core';

interface Props {
  artworkClass?: string;
}

const props = defineProps<Props>();

const { $mediaPlayer } = useNuxtApp();
const { state, hasCurrentTrack, currentTrack, queue } = useMediaPlayer();

const target = useTemplateRef('target');
const transitionName = ref('slide-left');

const currentTrackIndex = computed(() => {
  if (!currentTrack.value || !queue.value?.length) {
    return -1;
  }
  return queue.value.findIndex(track => track.id === currentTrack.value?.id);
});

const canSwipeLeft = computed(() => currentTrackIndex.value > 0);
const canSwipeRight = computed(() => currentTrackIndex.value < queue.value.length - 1 && currentTrackIndex.value !== -1);

const { isSwiping, lengthX } = useSwipe(target, {
  threshold: 60,
  onSwipeEnd: (e, direction) => {
    if (!direction) return; // Ignore short swipes

    if (direction === 'left' && canSwipeLeft.value) {
      transitionName.value = 'slide-right';
      $mediaPlayer.previous();
    } else if (direction === 'right' && canSwipeRight.value) {
      transitionName.value = 'slide-left';
      $mediaPlayer.next();
    }
  },
});

const swipeStyle = computed(() => {
  if (isSwiping.value) {
    let x = lengthX.value;

    if ((x < 0 && !canSwipeLeft.value) || (x > 0 && !canSwipeRight.value)) {
      x = 0;
    }

    const opacity = Math.max(0.2, 1 - Math.abs(x) / 200);
    return {
      transform: `translateX(${x}px)`,
      opacity: opacity,
      transition: 'none',
    };
  }

  return null;
});
</script>

<template>
  <div v-if="!hasCurrentTrack" class="flex-1 min-w-0" />
  <div v-else class="flex items-center gap-3 min-w-0 flex-1">
    <TrackArtwork :class="props.artworkClass" />
    
    <div ref="target" class="relative w-48 min-w-0 h-10">
      <Transition :name="transitionName">
        <div
          :key="currentTrack?.id"
          class="absolute inset-0 will-change-transform"
          :style="swipeStyle"
        >
          <div class="font-medium text-sm truncate">{{ state.currentTrack?.metadata?.title || 'Unknown Track' }}</div>
          <div class="text-muted-foreground text-xs truncate">{{ state.currentTrack?.metadata?.artist || 'Unknown Artist' }}</div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-leave-to {
  transform: translateX(-120%);
  opacity: 0;
}

.slide-left-enter-from {
  transform: translateX(120%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(120%);
  opacity: 0;
}
.slide-right-enter-from {
  transform: translateX(-120%);
  opacity: 0;
}
</style>