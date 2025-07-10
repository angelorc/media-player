<script setup lang="ts">
import { DEMO_TRACKS } from '~/lib/demo-tracks';

const { $mediaPlayer } = useNuxtApp();
const mediaContainerRef = ref(null);
const isReady = ref(false);

const filterTracksByPreferences = (tracks, preferences) => {
  if (!preferences || !preferences.mediaType) {
    return tracks;
  }

  if (preferences.mediaType.includes('video') && preferences.mediaType.includes('audio')) {
    return tracks;
  }

  if (preferences.mediaType.includes('audio') && !preferences.mediaType.includes('video')) {
    return tracks.filter(track => {
      return track.sources.some(source => source.mediaType === 'audio');
    });
  }

  if (preferences.mediaType.includes('video') && !preferences.mediaType.includes('audio')) {
    return tracks.filter(track => {
      return track.sources.some(source => source.mediaType === 'video');
    });
  }

  return tracks;
};

// const reloadTracksWithPreferences = () => {
//   if (!$mediaPlayer) return;
  
//   const currentState = $mediaPlayer.getState();
//   const preferences = currentState.preferences;
//   const filteredTracks = filterTracksByPreferences(DEMO_TRACKS, preferences);
  
//   let newStartIndex = 0;
//   if (currentState.currentTrack) {
//     const currentTrackIndex = filteredTracks.findIndex(track => track.id === currentState.currentTrack.id);
//     if (currentTrackIndex >= 0) {
//       newStartIndex = currentTrackIndex;
//     }
//   }
  
//   if (mediaContainerRef.value) {
//     console.log(`Reloading tracks with preferences: ${JSON.stringify(preferences)}`);
//     $mediaPlayer.loadQueue(filteredTracks, mediaContainerRef.value, newStartIndex, currentState.isPlaying);
//   }
// };

onMounted(() => {
  // $mediaPlayer.subscribe((state) => {
  //   if (state.preferences) {
  //     const filteredTracks = filterTracksByPreferences(DEMO_TRACKS, state.preferences);
      
  //     if (JSON.stringify(filteredTracks.map(t => t.id)) !== JSON.stringify(state.queue.map(t => t.id))) {
  //       setTimeout(() => reloadTracksWithPreferences(), 0);
  //     }
  //   }
  // });

  const initialFilteredTracks = filterTracksByPreferences(DEMO_TRACKS, $mediaPlayer.getState().preferences);
  if (mediaContainerRef.value) {
    console.log(`Initializing MediaPlayer with tracks: ${JSON.stringify(initialFilteredTracks.map(t => t.id))}`);
    $mediaPlayer.loadQueue(initialFilteredTracks, mediaContainerRef.value);
  }
  isReady.value = true;
});

onUnmounted(() => {
  $mediaPlayer.destroy();
});
</script>

<template>
  <div ref="mediaContainerRef" class="media-container" />

  <PlayerControls v-if="isReady && $mediaPlayer" />
</template>

<style scoped>
/* 
 * The media container is positioned off-screen but accessible
 * This allows video elements to be moved to the thumbnail when needed
 */
.media-container {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  z-index: -1;
}

/* When video is in fullscreen or PiP, it should be visible */
.media-container:has(video:fullscreen),
.media-container:has(video:picture-in-picture) {
  position: static;
  width: auto;
  height: auto;
  opacity: 1;
  pointer-events: auto;
  z-index: auto;
}
</style>