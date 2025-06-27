<script setup lang="ts">
import { MediaPlayer } from '@/lib/MediaPlayer';
import { HtmlMediaPlugin } from '@/lib/plugins/HtmlMediaPlugin'
import { HlsJsPlugin } from '@/lib/plugins/HlsJsPlugin';
// import { DEMO_TRACKS } from '@/lib/demo-tracks';
import MediaPlayerUI from './MediaPlayer.vue';

const mediaPlayer = ref(null);
const isReady = ref(false);

// Provide the mediaPlayer instance to all descendant components
provide('mediaPlayer', mediaPlayer);
provide('isReady', isReady);

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

onMounted(() => {
  const plugins = [new HlsJsPlugin(), new HtmlMediaPlugin()];
  const player = new MediaPlayer(plugins);
  mediaPlayer.value = player;

  player.loadQueue(DEMO_TRACKS, document.body);
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