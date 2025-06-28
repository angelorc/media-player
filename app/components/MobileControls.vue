<script setup lang="ts">
const { isVideo } = useMediaPlayer();

const isMobileExpanded = defineModel<boolean>();
</script>

<template>
  <div
    class="fixed bottom-0 left-0 right-0 z-50 h-16 bg-card border-t border-border/40"
    @click.prevent="isMobileExpanded = true"
  >
    <ProgressBar class="absolute -top-1 left-0 right-0 h-1" @click.stop />
    <div class="flex items-center h-full px-3 gap-3">
      <VideoThumbnail
        v-if="isVideo && !isMobileExpanded"
        display-mode="normal"
        class="flex-shrink-0 w-16 h-12"
      />
      <TrackInfo
        artwork-class="w-12 h-12"
        class="min-w-0"
      />
      <div class="flex items-center gap-2">
        <ButtonPlay @click.stop />
        <ButtonSkipForward @click.stop />
      </div>
    </div>
  </div>
</template>