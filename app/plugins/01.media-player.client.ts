import { MediaPlayer } from '~/lib/MediaPlayer'
import { HlsJsPlugin } from '~/lib/plugins/HlsJsPlugin';
import { HtmlMediaPlugin } from '~/lib/plugins/HtmlMediaPlugin';

export default defineNuxtPlugin({
  name: 'media-player',
  parallel: false, // Ensure sequential loading for dependencies
  async setup(nuxtApp) {
    const plugins = [new HlsJsPlugin(), new HtmlMediaPlugin()];
    const mediaPlayer = new MediaPlayer(plugins);

    return {
      provide: {
        mediaPlayer
      }
    }
  }
})
