<script setup lang="ts">
import { X, Heart, Shuffle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button';

const isMobileExpanded = defineModel<Boolean>();

const {
  currentTrack,
  isVideo,
  formattedDisplayTime,
  formattedDuration
} = useMediaPlayer();
</script>

<template>
  <div
    v-if="isMobileExpanded"
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
          <X class="h-7 w-7" />
        </Button>
      </div>

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
          <ButtonSkipBack />
          <ButtonPlay />
          <ButtonSkipForward />
        </div>
      </div>
    </div>
  </div>
</template>