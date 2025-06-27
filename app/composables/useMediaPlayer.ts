export function useMediaPlayer(mediaPlayerRef) {
  const state = ref(null);

  watch(mediaPlayerRef, (newMediaPlayer, oldMediaPlayer, onCleanup) => {
    if (!newMediaPlayer) {
      state.value = null;
      return;
    }

    const subscription = newMediaPlayer.subscribe((newState) => {
      state.value = newState;
    });

    // The onCleanup function is called when the watcher is stopped
    // or before the callback is executed again.
    onCleanup(() => {
      subscription.unsubscribe();
    });
  }, { immediate: true }); // immediate: true runs the callback right away

  return state;
}