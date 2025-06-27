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
    id: "bitsong-multi-source-demo",
    metadata: {
      title: "Bitsong Multi-Source Demo",
      artist: "Bitsong",
      artwork: "https://bitsong.io/logo.png",
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
  <!-- This is the hidden "engine room" where the video should be created. -->
  <div ref="mediaContainerRef" class="media-container" />

  <!-- Your application content -->
  <div id="main-content" class="transition-opacity">
    <slot />
  </div>

  <!-- The UI controls -->
  <MediaPlayerUI v-if="isReady && mediaPlayer" :media-player="mediaPlayer" />
</template>

<style scoped>
/* This ensures the container is hidden and doesn't affect your layout */
.media-container {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
}
</style>