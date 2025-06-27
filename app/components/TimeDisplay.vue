<script setup>
defineProps({
  currentTime: { type: Number, required: true },
  duration: { type: Number, required: true },
});

const formatTime = (seconds) => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};
</script>

<template>
  <div class="text-muted-foreground text-xs font-mono whitespace-nowrap w-24 text-center">
    {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
  </div>
</template>
