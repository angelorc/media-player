import { MediaPlayer } from '~/lib/MediaPlayer'
import { HlsJsPlugin } from '~/lib/plugins/HlsJsPlugin';
import { HtmlMediaPlugin } from '~/lib/plugins/HtmlMediaPlugin';
import { MediaSessionPlugin } from '~/lib/plugins/MediaSessionPlugin';

export default defineNuxtPlugin({
  name: 'media-player',
  parallel: false, // Ensure sequential loading for dependencies
  async setup(nuxtApp) {
    const mediaPlayer = new MediaPlayer({
      plugins: [
        new HlsJsPlugin(),
        new HtmlMediaPlugin(),
        new MediaSessionPlugin()
      ]
    });

    return {
      provide: {
        mediaPlayer
      }
    }
  }
})
