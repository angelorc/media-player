<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  List,
  X,
  Music
} from 'lucide-vue-next'

const isOpen = ref(false);

const {
  currentTrack,
  currentIndex,
  queue
} = useMediaPlayer()

const upNextTracks = computed(() => queue.value.slice(currentIndex.value + 1))
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :class="{
      'bg-accent text-accent-foreground': isOpen,
    }"
    title="Queue"
    @click="isOpen = !isOpen"
  >
    <List class="h-4 w-4" />
  </Button>
  <div
    v-if="isOpen"
    class="fixed bottom-24 right-4 w-96 max-h-[400px] bg-card border border-border/40 rounded-lg shadow-lg z-50 overflow-hidden"
  >
    <div class="flex items-center justify-between p-4 border-b border-border/40">
      <h3 class="font-semibold text-sm">Playback Queue</h3>
      <Button variant="ghost" size="icon" class="h-6 w-6" @click="isOpen = false">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <ScrollArea class="h-[340px]">
      <div class="p-4 space-y-6">
        <div v-if="currentTrack">
          <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Now Playing
          </div>
          <div class="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div class="flex-shrink-0 w-12 h-12 rounded-md bg-muted overflow-hidden">
              <img
                v-if="currentTrack.metadata?.artwork"
                :src="currentTrack.metadata.artwork"
                :alt="currentTrack.metadata.title"
                class="w-full h-full object-cover"
              >
              <div class="w-full h-full flex items-center justify-center">
                <Music class="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate">
                {{ currentTrack.metadata?.title || 'Unknown Title' }}
              </div>
              <div class="text-muted-foreground text-xs truncate">
                {{ currentTrack.metadata?.artist || 'Unknown Artist' }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="upNextTracks.length > 0">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Up Next ({{ upNextTracks.length }})
            </div>
          </div>

          <div class="space-y-1">
            <div
              v-for="(track, idx) in upNextTracks"
              :key="`${track.id}-${currentIndex + 1 + idx}`"
              class="group flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-accent/50"
              @click="$mediaPlayer.jumpTo(currentIndex + 1 + idx)"
            >
              <div class="flex-shrink-0 w-10 h-10 rounded bg-muted overflow-hidden">
                <img
                  v-if="track.metadata?.artwork"
                  :src="track.metadata.artwork"
                  :alt="track.metadata.title"
                  class="w-full h-full object-cover"
                >
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Music class="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">
                  {{ track.metadata?.title || "Unknown Track" }}
                </div>
                <div class="text-muted-foreground text-xs truncate">
                  {{ track.metadata?.artist || "Unknown Artist" }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!currentTrack && upNextTracks.length === 0"
          class="text-center py-8"
        >
          <Music class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div class="text-sm text-muted-foreground">No tracks in queue</div>
          <div class="text-xs text-muted-foreground mt-1">Add tracks to see them here</div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>