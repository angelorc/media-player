<script setup lang="ts">
const {
  formattedDisplayTime,
  formattedDuration,
} = useMediaPlayer();
</script>

<template>
  <div class="text-muted-foreground text-xs font-mono whitespace-nowrap w-24 text-center">
    {{ formattedDisplayTime }} / {{ formattedDuration }}
  </div>
</template>