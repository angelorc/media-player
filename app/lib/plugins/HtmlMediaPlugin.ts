import type { PlayerPlugin, MediaSource, PluginLoadOptions, PluginMediaControlHandlers } from '../types';
import type { PlayerStateStore } from '../state/PlayerStateStore';

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
  private stateStore: PlayerStateStore | null = null;
  private eventListeners: Array<{ event: string, handler: EventListenerOrEventListenerObject }> = [];

  isTypeSupported = (source: MediaSource): boolean => {
    const mimeType = StandardMimeTypes[source.format.toLowerCase()];
    if (!mimeType) return false;

    const tempElement = document.createElement(source.mediaType);
    const canPlayResult = tempElement.canPlayType && tempElement.canPlayType(mimeType);

    if (source.format.toLowerCase() === 'opus') {
      console.log(`HtmlMediaPlugin: Check Opus support for MIME type "${mimeType}". Browser canPlayType result: "${canPlayResult}"`);
    }
    
    return !!canPlayResult;
  }

  load = (
    source: MediaSource,
    stateStore: PlayerStateStore,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers> => {
    return new Promise<PluginMediaControlHandlers>((resolve, reject) => {
        this.onTrackUnload(); 

        this.stateStore = stateStore;
        this.currentContainer = options.containerElement;

        const mediaElement = document.createElement(source.mediaType) as HTMLVideoElement | HTMLAudioElement;
        this.mediaElement = mediaElement; // Assign early for cleanup and access in handlers

        const loadTimeout = setTimeout(() => {
            console.error('HtmlMediaPlugin: Loading timed out.');
            cleanupInitialListeners();
            reject(new Error(`Loading media timed out for ${source.src}`));
        }, 15000); // 15 second timeout

        mediaElement.setAttribute('playsinline', 'true');
        mediaElement.controls = false; 
        mediaElement.volume = options.initialVolume;
        mediaElement.muted = options.initialMute;
        
        if (source.mediaType === 'video') {
            (mediaElement as HTMLVideoElement).poster = source.src.startsWith('blob:') ? '' : (document.querySelector(`[data-src="${source.src}"]`) as HTMLVideoElement)?.poster || '';
        }

        const cleanupInitialListeners = () => {
            clearTimeout(loadTimeout);
            mediaElement.removeEventListener('canplay', onCanPlay);
            mediaElement.removeEventListener('error', onError);
        };

        const onError = () => {
            cleanupInitialListeners();
            const error = mediaElement.error;
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
            reject(new Error(errorMsg));
        };
        
        const onCanPlay = () => {
            cleanupInitialListeners();

            // Now that we know it can play, attach all the other state-updating listeners
            this._attachEventListeners(mediaElement, stateStore);
            
            if (options.autoplay) {
              mediaElement.play().catch(err => {
                console.warn(`HtmlMediaPlugin: Autoplay prevented for ${source.src}`, err);
                this.stateStore?.reportPaused();
              });
            }
            
            // Resolve with the control handlers
            resolve({
                play: async () => { if (this.mediaElement) await this.mediaElement.play(); },
                pause: () => { if (this.mediaElement) this.mediaElement.pause(); },
                stop: () => { 
                  if (this.mediaElement) {
                    this.mediaElement.pause();
                    this.mediaElement.removeAttribute('src');
                    this.mediaElement.load(); 
                  }
                  this.onTrackUnload(); 
                },
                seek: (time: number) => { if (this.mediaElement) this.mediaElement.currentTime = time; },
                setVolume: (volume: number, isMuted: boolean) => {
                  if (this.mediaElement) {
                    this.mediaElement.volume = volume;
                    this.mediaElement.muted = isMuted;
                    this.stateStore?.reportVolumeChange({ volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
                  }
                },
                getHTMLElement: () => this.mediaElement,
            });
        };
        
        mediaElement.addEventListener('error', onError);
        mediaElement.addEventListener('canplay', onCanPlay);

        if (this.currentContainer) {
            this.currentContainer.appendChild(mediaElement);
            if (mediaElement instanceof HTMLVideoElement) {
                mediaElement.style.width = '100%';
                mediaElement.style.height = '100%';
                mediaElement.style.objectFit = 'contain';
            }
        } else {
            const msg = 'HtmlMediaPlugin: Container element not provided.';
            this.stateStore.reportError(msg);
            cleanupInitialListeners();
            reject(new Error(msg));
            return;
        }

        mediaElement.src = source.src;
        mediaElement.load();
    });
  }
  
  private _removeEventListeners = (): void => {
    if (this.mediaElement) {
        this.eventListeners.forEach(({event, handler}) => {
            this.mediaElement?.removeEventListener(event, handler);
        });
    }
    this.eventListeners = [];
  }

  private _attachEventListeners = (
    mediaEl: HTMLAudioElement | HTMLVideoElement,
    stateStore: PlayerStateStore
  ): void => {
    this._removeEventListeners(); 

    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
        mediaEl.addEventListener(event, handler);
        this.eventListeners.push({event, handler});
    };
    
    // Note: 'canplay' and 'error' are handled initially in `load`. We re-attach `error` here
    // to catch issues that might occur *after* initial loading.
    add('loadstart', () => stateStore.reportLoading());
    add('loadedmetadata', () => stateStore.reportLoadedMetadata({ duration: mediaEl.duration }));
    add('loadeddata', () => { /* Often implies canplaythrough will follow, or at least canplay */ });
    add('canplaythrough', () => stateStore.reportCanPlay()); 
    add('playing', () => stateStore.reportPlaying());
    add('play', () => { /* Play intent, `playing` event confirms actual start */ });
    add('pause', () => stateStore.reportPaused());
    add('ended', () => {
      stateStore.reportEnded();
      // After reporting ended, the core player logic will handle 'next'
    });
    add('timeupdate', () => stateStore.reportTimeUpdate({ currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => stateStore.reportDurationChange({ duration: mediaEl.duration }));
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
      stateStore.reportError(errorMsg);
    });
    add('waiting', () => stateStore.reportWaiting());
    add('stalled', () => stateStore.reportStalled());
    
    add('volumechange', () => {
        stateStore.reportVolumeChange({ volume: mediaEl.volume, isMuted: mediaEl.muted });
    });

    this.mediaElement = mediaEl;
  }

  onTrackUnload = (): void => {
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
    this.stateStore = null;
  }

  destroy = (): void => {
    this.onTrackUnload(); 
  }
}