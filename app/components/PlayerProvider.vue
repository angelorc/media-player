<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { DEMO_TRACKS } from '~/lib/demo-tracks';
import MediaPlayerUI from './MediaPlayer.vue';

// Use the MediaPlayer from Nuxt plugin
const { $mediaPlayer } = useNuxtApp();
const mediaContainerRef = ref(null);
const isReady = ref(false);

// Function to filter tracks based on preferences
const filterTracksByPreferences = (tracks, preferences) => {
  if (!preferences || !preferences.mediaType) {
    return tracks;
  }

  // If both video and audio are allowed, show all tracks
  if (preferences.mediaType.includes('video') && preferences.mediaType.includes('audio')) {
    return tracks;
  }

  // If only audio is allowed, filter out tracks that have only video sources
  if (preferences.mediaType.includes('audio') && !preferences.mediaType.includes('video')) {
    return tracks.filter(track => {
      return track.sources.some(source => source.mediaType === 'audio');
    });
  }

  // If only video is allowed, filter out tracks that have only audio sources
  if (preferences.mediaType.includes('video') && !preferences.mediaType.includes('audio')) {
    return tracks.filter(track => {
      return track.sources.some(source => source.mediaType === 'video');
    });
  }

  return tracks;
};

// Watch for preference changes and reload filtered tracks
const reloadTracksWithPreferences = () => {
  if (!$mediaPlayer) return;
  
  const currentState = $mediaPlayer.getState();
  const preferences = currentState.preferences;
  const filteredTracks = filterTracksByPreferences(DEMO_TRACKS, preferences);
  
  // Find the current track index in the filtered list
  let newStartIndex = 0;
  if (currentState.currentTrack) {
    const currentTrackIndex = filteredTracks.findIndex(track => track.id === currentState.currentTrack.id);
    if (currentTrackIndex >= 0) {
      newStartIndex = currentTrackIndex;
    }
  }
  
  // Reload the queue with filtered tracks
  $mediaPlayer.loadQueue(filteredTracks, mediaContainerRef.value, newStartIndex, currentState.isPlaying);
};

onMounted(() => {
  // const plugins = [new HlsJsPlugin(), new HtmlMediaPlugin()];
  // const player = new MediaPlayer(plugins);
  // $mediaPlayer.value = player;

  // Subscribe to preference changes
  $mediaPlayer.subscribe((state) => {
    // Check if preferences changed and reload tracks if needed
    if (state.preferences) {
      const filteredTracks = filterTracksByPreferences(DEMO_TRACKS, state.preferences);
      
      // Only reload if the filtered tracks are different from current queue
      if (JSON.stringify(filteredTracks.map(t => t.id)) !== JSON.stringify(state.queue.map(t => t.id))) {
        setTimeout(() => reloadTracksWithPreferences(), 0);
      }
    }
  });

  // Load initial tracks
  const initialFilteredTracks = filterTracksByPreferences(DEMO_TRACKS, $mediaPlayer.getState().preferences);
  $mediaPlayer.loadQueue(initialFilteredTracks, mediaContainerRef.value);
  isReady.value = true;

  onUnmounted(() => {
    $mediaPlayer.destroy();
  });
});
</script>

<template>
  <!-- This is the "engine room" where the video/audio elements are created -->
  <div ref="mediaContainerRef" class="media-container" />

  <!-- Your application content -->
  <div id="main-content" class="transition-opacity">
    <slot />
  </div>

  <!-- The UI controls -->
  <MediaPlayerUI v-if="isReady && $mediaPlayer" :media-player="$mediaPlayer" />
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