<script setup>
import { ref, provide, onMounted, onUnmounted, computed, watch } from 'vue';
import { MediaPlayer } from '@/lib/MediaPlayer';
import { HtmlMediaPlugin } from '@/lib/plugins/HtmlMediaPlugin'
import { HlsJsPlugin } from '@/lib/plugins/HlsJsPlugin';
import MediaPlayerUI from './MediaPlayer.vue';

const DEMO_TRACKS = [
  {
    id: "ready-or-not",
    metadata: {
      title: "Ready or Not",
      artist: "Adam Clay",
      artwork: "https://media-api.bitsong.studio/ipfs/QmWF5LpGkH67fqv89cTrB36UAcxo2ZtbY9VSMv7wKKaAoQ",
    },
    sources: [
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/video/hls-video/master.m3u8",
        format: "hls",
        mediaType: "video",
        quality: "Video (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/QmauEHKa5UoRRz8wKNjdhhq4vxGgGr2P3QBMMXyYeH5HqP",
        format: "mp4",
        mediaType: "video",
        quality: "Video (MP4)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/hls/master.m3u8",
        format: "hls",
        mediaType: "audio",
        quality: "Audio (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/opus/8f82d255470cbadfcbd79e2ec2d6d096.opus",
        format: "opus",
        mediaType: "audio",
        quality: "Audio (Opus)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197a14d-c1b3-73ec-9075-4fefc940651f/audio/mp3/8f82d255470cbadfcbd79e2ec2d6d096.mp3",
        format: "mp3",
        mediaType: "audio",
        quality: "Audio (MP3)",
      },
    ],
  },
  {
    id: "cubana",
    metadata: {
      title: "Cubana",
      artist: "BlackJack Records",
      artwork: "https://media-api.bitsong.studio/ipfs/QmdijLzx2c43XnacBRLAB1rPCtkn4ePjKpfGMQZq2pfbZk",
    },
    sources: [
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/hls/master.m3u8",
        format: "hls",
        mediaType: "audio",
        quality: "Audio (HLS)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/opus/659fb82d4cbc762f18a43490cbf32a11.opus",
        format: "opus",
        mediaType: "audio",
        quality: "Audio (Opus)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/mp3/659fb82d4cbc762f18a43490cbf32a11.mp3",
        format: "mp3",
        mediaType: "audio",
        quality: "Audio (MP3)",
      },
      {
        src: "https://media-storage-test.bitsong.io/0197b1dd-92a5-7a5f-aff7-3ca549ffbdbe/audio/aac/659fb82d4cbc762f18a43490cbf32a11.m4a",
        format: "aac",
        mediaType: "audio",
        quality: "Audio (AAC)",
      },
    ],
  },
  {
    id: "big-buck-bunny",
    metadata: {
      title: "Big Buck Bunny",
      artist: "Blender Foundation",
      artwork: "https://d2zihajmogu5jn.cloudfront.net/big-buck-bunny/poster.jpg",
    },
    sources: [
      {
        src: "https://d2zihajmogu5jn.cloudfront.net/big-buck-bunny/master.m3u8",
        format: "hls",
        mediaType: "video",
        quality: "HLS Auto",
      },
    ],
  },
]

const mediaPlayer = ref(null);
const isReady = ref(false);
const mediaContainerRef = ref(null);

// Provide the mediaPlayer instance to all descendant components
provide('mediaPlayer', mediaPlayer);
provide('isReady', isReady);

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
  if (!mediaPlayer.value) return;
  
  const currentState = mediaPlayer.value.getState();
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
  mediaPlayer.value.loadQueue(filteredTracks, mediaContainerRef.value, newStartIndex, currentState.isPlaying);
};

onMounted(() => {
  const plugins = [new HlsJsPlugin(), new HtmlMediaPlugin()];
  const player = new MediaPlayer(plugins);
  mediaPlayer.value = player;

  // Subscribe to preference changes
  player.subscribe((state) => {
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
  const initialFilteredTracks = filterTracksByPreferences(DEMO_TRACKS, player.getState().preferences);
  player.loadQueue(initialFilteredTracks, mediaContainerRef.value);
  isReady.value = true;

  onUnmounted(() => {
    player.destroy();
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
  <MediaPlayerUI v-if="isReady && mediaPlayer" :media-player="mediaPlayer" />
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
