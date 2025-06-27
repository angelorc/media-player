
import type { PlayerPlugin, MediaSource, PluginCallbacks, PluginLoadOptions, PluginMediaControlHandlers } from '../types';

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
  private currentCallbacks: PluginCallbacks | null = null;
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
    callbacks: PluginCallbacks,
    options: PluginLoadOptions & { mediaElement?: HTMLVideoElement | HTMLAudioElement }
  ): Promise<PluginMediaControlHandlers> {
    this.onTrackUnload(); 

    this.currentCallbacks = callbacks;
    this.currentContainer = options.containerElement;

    if (options.mediaElement) {
      this.mediaElement = options.mediaElement;
    } else {
      this.mediaElement = document.createElement(source.mediaType) as HTMLVideoElement | HTMLAudioElement;
    }

    // this.mediaElement = document.createElement(source.mediaType) as HTMLVideoElement | HTMLAudioElement;
    this.mediaElement.setAttribute('playsinline', 'true');
    this.mediaElement.controls = false; 
    this.mediaElement.volume = options.initialVolume;
    this.mediaElement.muted = options.initialMute;
    
    if (source.mediaType === 'video') {
        (this.mediaElement as HTMLVideoElement).poster = source.src.startsWith('blob:') ? '' : (source.mediaType === 'video' ? (document.querySelector(`[data-src="${source.src}"]`) as HTMLVideoElement)?.poster || '' : '');
    }


    this._attachEventListeners(this.mediaElement, callbacks);
    
    this.mediaElement.src = source.src;
    this.mediaElement.load();

    if (this.currentContainer) {
      this.currentContainer.appendChild(this.mediaElement);
      // if (this.mediaElement instanceof HTMLVideoElement) {
      //   this.mediaElement.style.width = '100%';
      //   this.mediaElement.style.height = '100%';
      //   this.mediaElement.style.objectFit = 'contain';
      // }
    } else {
        callbacks.onError('HtmlMediaPlugin: Container element not provided.', true);
        throw new Error('Container element not provided for HtmlMediaPlugin');
    }

    if (options.autoplay) {
      this.mediaElement.play().catch(err => {
        console.warn(`HtmlMediaPlugin: Autoplay prevented for ${source.src}`, err);
        callbacks.onPaused(); 
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
          callbacks.onVolumeChange?.({ volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
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
    callbacks: PluginCallbacks
  ): void {
    this._removeEventListeners(); 

    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
        mediaEl.addEventListener(event, handler);
        this.eventListeners.push({event, handler});
    };

    add('loadstart', () => callbacks.onLoading());
    add('loadedmetadata', () => callbacks.onLoadedMetadata({ duration: mediaEl.duration }));
    add('loadeddata', () => { /* Often implies canplaythrough will follow, or at least canplay */ });
    add('canplay', () => callbacks.onCanPlay());
    add('canplaythrough', () => callbacks.onCanPlay()); 
    add('playing', () => callbacks.onPlaying());
    add('play', () => { /* Play intent, `playing` event confirms actual start */ });
    add('pause', () => callbacks.onPaused());
    add('ended', () => callbacks.onEnded());
    add('timeupdate', () => callbacks.onTimeUpdate({ currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => callbacks.onDurationChange?.({ duration: mediaEl.duration }));
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
      callbacks.onError(errorMsg, true, error);
    });
    add('waiting', () => callbacks.onWaiting?.());
    add('stalled', () => callbacks.onStalled?.());
    
    add('volumechange', () => {
        callbacks.onVolumeChange?.({ volume: mediaEl.volume, isMuted: mediaEl.muted });
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
    this.currentCallbacks = null;
  }

  destroy(): void {
    this.onTrackUnload(); 
  }
}
