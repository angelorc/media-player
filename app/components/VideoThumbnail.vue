<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
  displayMode: {
    type: String,
    validator: (value) => ['normal', 'pip', 'fullscreen'].includes(value),
    required: true,
  },
});

const emit = defineEmits(['togglePip', 'toggleFullscreen']);

const thumbnailRef = ref(null);
const videoMoved = ref(false);

const state = computed(() => props.mediaPlayer?.getState?.() || null);
const isVideo = computed(() => state.value?.activeSource?.mediaType === 'video');

const handleThumbnailClick = () => {
  if (props.displayMode === 'normal') {
    emit('togglePip');
  } else if (props.displayMode === 'pip') {
    emit('toggleFullscreen');
  }
};

const handleDoubleClick = () => {
  emit('toggleFullscreen');
};

const moveVideoToThumbnail = async () => {
  if (!isVideo.value || !thumbnailRef.value || props.displayMode !== 'normal') {
    return;
  }
  
  await nextTick();
  
  const videoElement = props.mediaPlayer.getActiveHTMLElement();
  if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
    return;
  }

  // Only move if not already in thumbnail
  if (videoElement.parentNode !== thumbnailRef.value) {
    console.log('Moving video element to thumbnail');
    
    // Store original styles
    const originalStyles = {
      position: videoElement.style.position,
      top: videoElement.style.top,
      left: videoElement.style.left,
      width: videoElement.style.width,
      height: videoElement.style.height,
      objectFit: videoElement.style.objectFit,
      borderRadius: videoElement.style.borderRadius,
      cursor: videoElement.style.cursor,
      zIndex: videoElement.style.zIndex,
    };

    // Apply thumbnail styles
    videoElement.style.position = 'absolute';
    videoElement.style.top = '0';
    videoElement.style.left = '0';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';
    videoElement.style.borderRadius = '8px';
    videoElement.style.cursor = 'pointer';
    videoElement.style.zIndex = '1';

    // Move to thumbnail container
    try {
      thumbnailRef.value.appendChild(videoElement);
      videoMoved.value = true;
      console.log('Video element successfully moved to thumbnail');

      // Store original styles for restoration
      videoElement._originalStyles = originalStyles;
    } catch (error) {
      console.error('Error moving video to thumbnail:', error);
    }
  }
};

const restoreVideoPosition = () => {
  if (!videoMoved.value) return;
  
  const videoElement = props.mediaPlayer.getActiveHTMLElement();
  if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
    return;
  }

  // Restore original styles
  if (videoElement._originalStyles) {
    Object.assign(videoElement.style, videoElement._originalStyles);
    delete videoElement._originalStyles;
  } else {
    // Reset to default
    videoElement.style.position = '';
    videoElement.style.top = '';
    videoElement.style.left = '';
    videoElement.style.width = '';
    videoElement.style.height = '';
    videoElement.style.objectFit = '';
    videoElement.style.borderRadius = '';
    videoElement.style.cursor = '';
  }

  // Move back to hidden container
  const hiddenContainer = document.querySelector('.media-container');
  if (hiddenContainer && videoElement.parentNode !== hiddenContainer) {
    hiddenContainer.appendChild(videoElement);
  }
  
  videoMoved.value = false;
};

const updateVideoPosition = () => {
  if (props.displayMode === 'normal' && isVideo.value) {
    moveVideoToThumbnail();
  } else if (videoMoved.value) {
    restoreVideoPosition();
  }
};

// Watch for changes in display mode, video source, or video availability
watch([() => props.displayMode, isVideo, () => state.value?.activeSource?.src], () => {
  // Use nextTick to ensure the new video element is ready
  nextTick(() => {
    updateVideoPosition();
  });
}, { immediate: false });

// Watch for changes in the video element itself
watch(() => props.mediaPlayer.getActiveHTMLElement(), () => {
  // Reset the moved state when a new video element is created
  videoMoved.value = false;
  nextTick(() => {
    updateVideoPosition();
  });
}, { immediate: false });

// Watch for playback state changes to ensure video positioning
watch(() => state.value?.playbackState, (newState) => {
  if (newState === 'PLAYING' || newState === 'PAUSED') {
    nextTick(() => {
      updateVideoPosition();
    });
  }
}, { immediate: false });

let checkInterval = null;

// Update position when component mounts
onMounted(() => {
  // Use nextTick to ensure DOM is ready
  nextTick(() => {
    updateVideoPosition();
  });
  
  // Set up a periodic check to ensure video stays in thumbnail
  checkInterval = setInterval(() => {
    if (props.displayMode === 'normal' && isVideo.value) {
      const videoElement = props.mediaPlayer.getActiveHTMLElement();
      if (videoElement && videoElement.parentNode !== thumbnailRef.value) {
        console.log('Video element found outside thumbnail, moving it back');
        updateVideoPosition();
      }
    }
  }, 500); // Check every 500ms for faster response
});

// Clean up when component unmounts
onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  if (videoMoved.value) {
    restoreVideoPosition();
  }
});
</script>

<template>
  <div 
    v-if="isVideo && displayMode === 'normal'" 
    ref="thumbnailRef"
    class="relative w-20 h-15 bg-black rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-600"
    @click="handleThumbnailClick"
    @dblclick="handleDoubleClick"
    title="Click for Picture-in-Picture, Double-click for Fullscreen"
  >
    <!-- Loading placeholder if video element is not yet available -->
    <div 
      v-if="!mediaPlayer.getActiveHTMLElement() || state?.isLoading" 
      class="absolute inset-0 bg-gray-800 flex items-center justify-center"
    >
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
    </div>
    
    <!-- Overlay with play icon when paused -->
    <div 
      v-if="state && !state.isPlaying && !state.isLoading"
      class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center pointer-events-none z-10"
    >
      <div class="w-6 h-6 text-white opacity-80">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure the thumbnail container has proper dimensions */
.w-20 {
  width: 80px;
}
.h-15 {
  height: 60px;
}

/* Ensure video elements inside thumbnail are properly contained */
:deep(video) {
  max-width: 100%;
  max-height: 100%;
}
</style>
