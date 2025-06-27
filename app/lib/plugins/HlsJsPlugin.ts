
import Hls from 'hls.js';
import { Events, ErrorTypes, ErrorDetails } from 'hls.js';
import type {
  HlsConfig,
  ErrorData,
  ManifestParsedData,
  LevelSwitchedData,
  Level as HlsJsLevel 
} from 'hls.js';
import type { PlayerPlugin, MediaSource, PluginCallbacks, PluginLoadOptions, PluginMediaControlHandlers, PluginSelectableOption } from '../types';

export class HlsJsPlugin implements PlayerPlugin {
  public name = 'HlsJsPlugin';
  private hlsInstance: Hls | null = null;
  private mediaElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private currentCallbacks: PluginCallbacks | null = null;
  private eventListeners: Array<{ event: string, handler: EventListenerOrEventListenerObject }> = [];
  private hlsEventListeners: Array<{ event: Events, handler: (eventName: string, data: any) => void }> = [];
  private hlsLevels: HlsJsLevel[] = [];


  isTypeSupported(source: MediaSource): boolean {
    return source.format.toLowerCase() === 'hls' && Hls && Hls.isSupported();
  }

  private _mapHlsLevelsToOptions(levels: HlsJsLevel[]): PluginSelectableOption[] {
    const options: PluginSelectableOption[] = [{ id: 'auto', label: 'Auto (HLS)' }];
    levels.forEach((level, index) => {
      options.push({
        id: index.toString(), 
        label: level.height
          ? `HLS ${level.height}p (${Math.round(level.bitrate / 1000)} kbps)`
          : level.name || `HLS ${Math.round(level.bitrate / 1000)} kbps (Level ${index})`,
      });
    });
    return options;
  }

  async load(
    source: MediaSource,
    callbacks: PluginCallbacks,
    options: PluginLoadOptions & { mediaElement?: HTMLVideoElement | HTMLAudioElement }
  ): Promise<PluginMediaControlHandlers> {
    this.onTrackUnload(); 

    if (!Hls || !Hls.isSupported()) {
      callbacks.onError('HLS.js is not supported or not loaded correctly.', true);
      throw new Error('HLS.js is not supported or not loaded correctly.');
    }

    this.currentCallbacks = callbacks;
    this.currentContainer = options.containerElement;
    this.hlsLevels = []; 

    if (options.mediaElement) {
      this.mediaElement = options.mediaElement;
    } else {
      this.mediaElement = document.createElement(source.mediaType === 'audio' ? 'audio' : 'video') as HTMLVideoElement | HTMLAudioElement;
    }

    // this.mediaElement = document.createElement(source.mediaType === 'audio' ? 'audio' : 'video') as HTMLVideoElement | HTMLAudioElement;
    this.mediaElement.setAttribute('playsinline', 'true');
    this.mediaElement.controls = false;
    this.mediaElement.volume = options.initialVolume;
    this.mediaElement.muted = options.initialMute;

    if (this.mediaElement instanceof HTMLVideoElement) {
      (this.mediaElement as HTMLVideoElement).poster = source.src.startsWith('blob:') ? '' : (document.querySelector(`[data-src="${source.src}"]`) as HTMLVideoElement)?.poster || '';
    }

    this._attachMediaElementEventListeners(this.mediaElement, callbacks);

    const hlsConfig: Partial<HlsConfig> = {
      debug: false, 
      maxBufferLength: 30,
      maxMaxBufferLength: 120,
      maxBufferHole: 1.0,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 3,
      levelLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 1000,
      startLevel: -1, 
    };
    this.hlsInstance = new Hls(hlsConfig);

    this._attachHlsEventListeners(this.hlsInstance, callbacks);

    this.hlsInstance.loadSource(source.src);
    this.hlsInstance.attachMedia(this.mediaElement);

    if (this.currentContainer) {
      this.currentContainer.appendChild(this.mediaElement);
      // if (this.mediaElement instanceof HTMLVideoElement) {
      //   this.mediaElement.style.width = '100%';
      //   this.mediaElement.style.height = '100%';
      //   this.mediaElement.style.objectFit = 'contain';
      // }
    } else {
      callbacks.onError('HlsPlugin: Container element not provided.', true);
      throw new Error('Container element not provided for HlsPlugin');
    }

    if (options.autoplay && this.mediaElement) {
      this.mediaElement.play().catch(err => {
        console.warn(`HlsPlugin: Autoplay prevented for ${source.src}`, err);
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
        if (this.hlsInstance) this.hlsInstance.stopLoad();
        if (this.mediaElement) {
          this.mediaElement.pause();
          this.mediaElement.removeAttribute('src'); 
          this.mediaElement.load(); 
        }
      },
      seek: (time: number) => {
        if (this.mediaElement) {
          this.mediaElement.currentTime = time;
        }
      },
      setVolume: (volume: number, isMuted: boolean) => {
        if (this.mediaElement) {
          this.mediaElement.volume = volume;
          this.mediaElement.muted = isMuted;
          callbacks.onVolumeChange?.({ volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
        }
      },
      getHTMLElement: () => this.mediaElement,
      setPluginOption: async (optionId: string) => {
        if (this.hlsInstance) {
          if (optionId === 'auto') {
            this.hlsInstance.currentLevel = -1; 
          } else {
            const levelIndex = parseInt(optionId, 10);
            if (!isNaN(levelIndex) && levelIndex >= 0 && levelIndex < this.hlsInstance.levels.length) {
              this.hlsInstance.currentLevel = levelIndex;
            } else {
              console.warn(`HlsPlugin: Invalid level ID received: ${optionId}`);
            }
          }
        }
      },
    };
  }

  private _removeEventListeners(): void {
    if (this.mediaElement) {
      this.eventListeners.forEach(({ event, handler }) => {
        this.mediaElement?.removeEventListener(event, handler as EventListenerOrEventListenerObject);
      });
    }
    this.eventListeners = [];

    if (this.hlsInstance) {
      this.hlsEventListeners.forEach(({ event, handler }) => {
        this.hlsInstance?.off(event, handler);
      });
    }
    this.hlsEventListeners = [];
  }

  private _attachMediaElementEventListeners(
    mediaEl: HTMLAudioElement | HTMLVideoElement,
    callbacks: PluginCallbacks
  ): void {
    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
      mediaEl.addEventListener(event, handler);
      this.eventListeners.push({ event, handler });
    };

    add('loadstart', () => callbacks.onLoading());
    add('loadedmetadata', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) callbacks.onLoadedMetadata({ duration: mediaEl.duration }); });
    add('canplay', () => callbacks.onCanPlay());
    add('playing', () => callbacks.onPlaying());
    add('pause', () => callbacks.onPaused());
    add('ended', () => callbacks.onEnded());
    add('timeupdate', () => callbacks.onTimeUpdate({ currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) callbacks.onDurationChange?.({ duration: mediaEl.duration }); });
    add('error', () => {
      const error = mediaEl.error;
      callbacks.onError(`HTMLMediaElement error: Code ${error?.code || 'unknown'} - ${error?.message || 'No message'}`, true, error);
    });
    add('waiting', () => callbacks.onWaiting?.());
    add('stalled', () => callbacks.onStalled?.());
    add('volumechange', () => {
      callbacks.onVolumeChange?.({ volume: mediaEl.volume, isMuted: mediaEl.muted });
    });
    this.mediaElement = mediaEl;
  }

  private _attachHlsEventListeners(hls: Hls, callbacks: PluginCallbacks): void {
    const addHls = (event: Events, handler: (eventName: string, data: any) => void) => {
      hls.on(event, handler);
      this.hlsEventListeners.push({ event, handler });
    };

    addHls(Events.MANIFEST_LOADING, () => callbacks.onLoading());

    addHls(Events.MANIFEST_PARSED, (_event, _data: ManifestParsedData) => {
      if (hls.levels) {
        this.hlsLevels = [...hls.levels]; 
        callbacks.onPluginOptionsAvailable?.(this._mapHlsLevelsToOptions(this.hlsLevels));
      }
      const initialActiveId = hls.autoLevelEnabled ? 'auto' : hls.currentLevel.toString();
      callbacks.onPluginOptionChanged?.(initialActiveId);
    });

    addHls(Events.LEVEL_SWITCHED, (_event, data: LevelSwitchedData) => {
      const activeId = hls.autoLevelEnabled ? 'auto' : data.level.toString();
      callbacks.onPluginOptionChanged?.(activeId);
    });

    addHls(Events.ERROR, (_event, data: ErrorData) => {
      if (!this.hlsInstance) return;
      const errorDetailsMessage = `HLS Error: ${data.details} (type: ${data.type})`;

      if (data.type === ErrorTypes.MEDIA_ERROR) {
        if (data.fatal) {
          if (data.details === ErrorDetails.BUFFER_STALLED_ERROR || data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
            this.hlsInstance.recoverMediaError();
          }
          callbacks.onError(errorDetailsMessage, true, data);
        } else {
          if (data.details === ErrorDetails.BUFFER_STALLED_ERROR) callbacks.onStalled?.();
          else if (data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) callbacks.onWaiting?.();
          else callbacks.onWaiting?.();
        }
      } else if (data.type === ErrorTypes.NETWORK_ERROR) {
        if (data.fatal) {
          callbacks.onError(errorDetailsMessage, true, data);
        } else {
          callbacks.onWaiting?.();
        }
      } else {
        callbacks.onError(errorDetailsMessage, data.fatal, data);
      }
    });
  }

  onTrackUnload(): void {
    this._removeEventListeners(); 
    if (this.hlsInstance) {
      this.hlsInstance.stopLoad(); 
      this.hlsInstance.detachMedia(); 
      this.hlsInstance.destroy(); 
      this.hlsInstance = null;
    }
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
    this.hlsLevels = [];
  }

  destroy(): void {
    this.onTrackUnload();
  }
}
