<script setup>
import { Button } from '@/components/ui/button';
import { Maximize, Minimize, PictureInPicture2 } from 'lucide-vue-next';

defineProps({
  displayMode: {
    type: String,
    validator: (value) => ['normal', 'pip', 'fullscreen'].includes(value),
    required: true,
  },
});

const emit = defineEmits(['togglePip', 'toggleFullscreen']);

const isPipSupported = ref(false);

onMounted(() => {
  isPipSupported.value = !!document.pictureInPictureEnabled;
});
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      v-if="isPipSupported"
      variant="ghost"
      size="icon"
      @click="emit('togglePip')"
      :class="{ 'bg-accent text-accent-foreground': displayMode === 'pip' }"
      :title="displayMode === 'pip' ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'"
    >
      <PictureInPicture2 class="h-5 w-5" />
    </Button>

    <Button
      variant="ghost"
      size="icon"
      @click="emit('toggleFullscreen')"
      :title="displayMode === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen'"
    >
      <Minimize v-if="displayMode === 'fullscreen'" class="h-5 w-5" />
      <Maximize v-else class="h-5 w-5" />
    </Button>
  </div>
</template>