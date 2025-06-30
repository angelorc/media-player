import type { PlayerPlugin, MediaSource, PluginLoadOptions, PluginMediaControlHandlers, PluginApi } from '../types';

const StandardMimeTypes: Record<string, string> = {
  // Audio
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  opus: 'audio/opus', 
  // Video
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
};

export class HtmlMediaPlugin implements PlayerPlugin {
  public name = 'HtmlMediaPlugin';
  private mediaElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private pluginApi: PluginApi | null = null;
  private eventListeners: Array<{ event: string, handler: EventListenerOrEventListenerObject }> = [];

  isTypeSupported(source: MediaSource): boolean {
    const mimeType = StandardMimeTypes[source.format.toLowerCase()];
    if (!mimeType) return false;

    const tempElement = document.createElement(source.mediaType);
    const canPlayResult = tempElement.canPlayType && tempElement.canPlayType(mimeType);

    if (source.format.toLowerCase() === 'opus') {
      console.log(`HtmlMediaPlugin: Check Opus support for MIME type "${mimeType}". Browser canPlayType result: "${canPlayResult}"`);
    }
    
    return !!canPlayResult;
  }

  async load(
    source: MediaSource,
    pluginApi: PluginApi,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers> {
    this.onTrackUnload(); 

    this.pluginApi = pluginApi;
    this.currentContainer = options.containerElement;

    this.mediaElement = document.createElement(source.mediaType) as HTMLVideoElement | HTMLAudioElement;
    this.mediaElement.setAttribute('playsinline', 'true');
    this.mediaElement.controls = false; 
    this.mediaElement.volume = options.initialVolume;
    this.mediaElement.muted = options.initialMute;
    
    if (source.mediaType === 'video') {
        (this.mediaElement as HTMLVideoElement).poster = source.src.startsWith('blob:') ? '' : (source.mediaType === 'video' ? (document.querySelector(`[data-src="${source.src}"]`) as HTMLVideoElement)?.poster || '' : '');
    }


    this._attachEventListeners(this.mediaElement, pluginApi);
    
    this.mediaElement.src = source.src;
    this.mediaElement.load();

    if (this.currentContainer) {
      this.currentContainer.appendChild(this.mediaElement);
      if (this.mediaElement instanceof HTMLVideoElement) {
        this.mediaElement.style.width = '100%';
        this.mediaElement.style.height = '100%';
        this.mediaElement.style.objectFit = 'contain';
      }
    } else {
        this.pluginApi.events.callHook('plugin:error', { message: 'HtmlMediaPlugin: Container element not provided.', fatal: true });
        throw new Error('Container element not provided for HtmlMediaPlugin');
    }

    if (options.autoplay) {
      this.mediaElement.play().catch(err => {
        console.warn(`HtmlMediaPlugin: Autoplay prevented for ${source.src}`, err);
        this.pluginApi?.events.callHook('plugin:paused');
      });
    }


    return {
      play: async () => {
        if (this.mediaElement) await this.mediaElement.play();
      },
      pause: () => {
        if (this.mediaElement) this.mediaElement.pause();
      },
      stop: () => { 
        if (this.mediaElement) {
          this.mediaElement.pause();
          this.mediaElement.removeAttribute('src');
          this.mediaElement.load(); 
        }
        this.onTrackUnload(); 
      },
      seek: (time: number) => {
        if (this.mediaElement) this.mediaElement.currentTime = time;
      },
      setVolume: (volume: number, isMuted: boolean) => {
        if (this.mediaElement) {
          this.mediaElement.volume = volume;
          this.mediaElement.muted = isMuted;
          this.pluginApi?.events.callHook('plugin:volumechange', { volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
        }
      },
      getHTMLElement: () => this.mediaElement,
    };
  }
  
  private _removeEventListeners(): void {
    if (this.mediaElement) {
        this.eventListeners.forEach(({event, handler}) => {
            this.mediaElement?.removeEventListener(event, handler);
        });
    }
    this.eventListeners = [];
  }

  private _attachEventListeners(
    mediaEl: HTMLAudioElement | HTMLVideoElement,
    pluginApi: PluginApi
  ): void {
    this._removeEventListeners(); 

    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
        mediaEl.addEventListener(event, handler);
        this.eventListeners.push({event, handler});
    };

    add('loadstart', () => pluginApi.events.callHook('plugin:loading'));
    add('loadedmetadata', () => pluginApi.events.callHook('plugin:loadedmetadata', { duration: mediaEl.duration }));
    add('loadeddata', () => { /* Often implies canplaythrough will follow, or at least canplay */ });
    add('canplay', () => pluginApi.events.callHook('plugin:canplay'));
    add('canplaythrough', () => pluginApi.events.callHook('plugin:canplay')); 
    add('playing', () => pluginApi.events.callHook('plugin:playing'));
    add('play', () => { /* Play intent, `playing` event confirms actual start */ });
    add('pause', () => pluginApi.events.callHook('plugin:paused'));
    add('ended', () => pluginApi.events.callHook('plugin:ended'));
    add('timeupdate', () => pluginApi.events.callHook('plugin:timeupdate', { currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => pluginApi.events.callHook('plugin:durationchange', { duration: mediaEl.duration }));
    add('error', () => {
      const error = mediaEl.error;
      let errorMsg = `Media Error: Code ${error?.code}`;
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED: errorMsg += ' - Playback aborted.'; break;
          case MediaError.MEDIA_ERR_NETWORK: errorMsg += ' - Network error.'; break;
          case MediaError.MEDIA_ERR_DECODE: errorMsg += ' - Decoding error.'; break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg += ' - Source not supported.'; break;
          default: errorMsg += ' - Unknown media error.'; break;
        }
      } else {
        errorMsg = 'An unknown media error occurred on the element.';
      }
      pluginApi.events.callHook('plugin:error', { message: errorMsg, fatal: true, details: error });
    });
    add('waiting', () => pluginApi.events.callHook('plugin:waiting'));
    add('stalled', () => pluginApi.events.callHook('plugin:stalled'));
    
    add('volumechange', () => {
        pluginApi.events.callHook('plugin:volumechange', { volume: mediaEl.volume, isMuted: mediaEl.muted });
    });

    this.mediaElement = mediaEl;
  }

  onTrackUnload(): void {
    this._removeEventListeners();
    if (this.mediaElement) {
      this.mediaElement.pause();
      this.mediaElement.removeAttribute('src'); 
      this.mediaElement.load(); 
      if (this.mediaElement.parentNode) {
        this.mediaElement.parentNode.removeChild(this.mediaElement);
      }
      this.mediaElement = null;
    }
    this.currentContainer = null;
    this.pluginApi = null;
  }

  destroy(): void {
    this.onTrackUnload(); 
  }
}
