<template>
  <div v-if="!state?.currentTrack" class="flex-1 min-w-0" />
  <div v-else class="flex items-center gap-3 min-w-0 flex-1">
    <!-- This div is the destination for the video element -->
    <div
      ref="videoContainerRef"
      class="relative flex-shrink-0 w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden"
    >
      <!-- If the track is not a video, show the artwork/icon as a fallback -->
      <template v-if="!isVideo">
        <img
          v-if="state.currentTrack.metadata?.artwork"
          :src="state.currentTrack.metadata.artwork || '/placeholder.svg'"
          :alt="state.currentTrack.metadata.title || 'Track artwork'"
          class="w-full h-full object-cover"
        />
        <Music v-else class="h-6 w-6 text-muted-foreground" />
      </template>
    </div>
    <div class="min-w-0">
      <div class="font-medium text-sm truncate">{{ state.currentTrack.metadata?.title || 'Unknown Track' }}</div>
      <div class="text-muted-foreground text-xs truncate">{{ state.currentTrack.metadata?.artist || 'Unknown Artist' }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useMediaPlayer } from '@/composables/useMediaPlayer';
import { Music } from 'lucide-vue-next';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});

const mediaPlayerRef = ref(props.mediaPlayer);
const state = useMediaPlayer(mediaPlayerRef);
const videoContainerRef = ref(null);

const isVideo = computed(() => state.value?.activeSource?.mediaType === 'video');

// This function safely removes all child nodes from an element.
const emptyContainer = (el) => {
  if (el) {
    el.innerHTML = '';
  }
};

watch(
  () => state.value?.activeSource?.src,
  () => {
    const container = videoContainerRef.value;
    if (!container) return;

    // Always clear our thumbnail container first.
    emptyContainer(container);

    if (isVideo.value) {
      // Find the video inside the `.media-container` we fixed in PlayerProvider.
      const videoEl = document.querySelector('.media-container video');

      if (videoEl) {
        // We found it! Now we take control.
        videoEl.removeAttribute('style'); // Remove any old styles
        Object.assign(videoEl.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        });
        // Move the element into our component's thumbnail container.
        container.appendChild(videoEl);
      }
    }
  },
  {
    // `flush: 'post'` ensures this runs AFTER the library has created the element.
    flush: 'post',
  }
);
</script>