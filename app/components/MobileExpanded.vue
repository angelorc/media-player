<script setup lang="ts">
import { ChevronDown, Heart } from 'lucide-vue-next'
import { Button } from '@/components/ui/button';
import { useMediaPlayer } from '@/composables/useMediaPlayer'; // Ensure this is imported
import { useSwipe } from '@vueuse/core'; // Ensure this is imported

const isMobileExpanded = defineModel<boolean>();

const { $mediaPlayer } = useNuxtApp();

const {
  hasCurrentTrack,
  currentTrack,
  queue,
  isVideo,
  formattedDisplayTime,
  formattedDuration
} = useMediaPlayer();

const swipeTarget = useTemplateRef('swipeTarget');
const transitionName = ref('slide-left');

const currentTrackIndex = computed(() => {
  if (!currentTrack.value || !queue.value?.length) {
    return -1;
  }
  return queue.value.findIndex(track => track.id === currentTrack.value?.id);
});

const canSwipeLeft = computed(() => currentTrackIndex.value > 0);
const canSwipeRight = computed(() => currentTrackIndex.value < queue.value.length - 1 && currentTrackIndex.value !== -1);

const { isSwiping, lengthX } = useSwipe(swipeTarget, {
  threshold: 60,
  onSwipeEnd: (e, direction) => {
    if (!direction) return;

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
      if (x < 0) x = x * 0.2;
      if (x > 0) x = x * 0.2;
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

onMounted(() => nextTick())
</script>

<template>
  <div
    v-if="isMobileExpanded && hasCurrentTrack"
    class="fixed inset-0 z-[100] flex flex-col bg-black"
  >
    <div class="absolute inset-0 overflow-hidden">
      <img
        v-if="currentTrack?.metadata?.artwork"
        :src="currentTrack.metadata.artwork"
        :alt="currentTrack.metadata.title"
        class="w-full h-full object-cover blur-3xl scale-125"
        aria-hidden="true"
      >
      <div class="absolute inset-0 bg-black/60" />
    </div>

    <div class="relative z-10 flex flex-col h-full p-6">
      <div class="flex-shrink-0 flex items-start justify-end">
        <Button variant="ghost" size="icon" class="text-white/80 hover:text-white" @click="isMobileExpanded = false">
          <ChevronDown class="h-7 w-7" />
        </Button>
      </div>

      <div
        ref="swipeTarget"
        class="flex-1 flex flex-col justify-center min-h-0 relative"
      >
        <Transition :name="transitionName">
          <div
            :key="currentTrack?.id"
            class="absolute inset-0 will-change-transform flex flex-col justify-center gap-8"
            :style="swipeStyle"
          >
            <div class="flex-1 flex items-center justify-center my-6 min-h-0">
              <VideoThumbnail
                v-if="isVideo"
                :display-mode="'normal'"
                class="w-full h-60 rounded-lg"
              />
              <TrackArtwork v-else class="w-full h-full object-cover" />
            </div>

            <div class="flex-shrink-0 space-y-8">
              <div class="flex items-center">
                <div class="flex-1 min-w-0">
                  <h2 class="text-2xl font-bold text-white truncate">
                    {{ currentTrack?.metadata?.title || 'Unknown Title' }}
                  </h2>
                  <p class="text-lg text-white/70 truncate">
                    {{ currentTrack?.metadata?.artist || 'Unknown Artist' }}
                  </p>
                </div>
                <MediaTypeSelector class="text-white/80" />
                <Button variant="ghost" size="icon" class="text-white/80 ml-4">
                  <Heart class="h-6 w-6" />
                </Button>
              </div>

              <div>
                <ProgressBar />
                <div class="flex justify-between text-xs text-white/60 mt-2 font-mono">
                  <span>{{ formattedDisplayTime }}</span>
                  <span>{{ formattedDuration }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between text-white/80">
                <ButtonSkipBack fill="currentColor" />
                <ButtonPlay class="w-16 h-16" />
                <ButtonSkipForward fill="currentColor" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
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