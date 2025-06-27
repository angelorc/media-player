<script setup>
defineProps({
  mediaPlayer: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <PlayerControls :media-player="mediaPlayer" />
</template>