import Hls, { Events, ErrorTypes, ErrorDetails } from 'hls.js';
// import type { Events, ErrorTypes, ErrorDetails } from 'hls.js';
import type {
  HlsConfig,
  ErrorData,
  ManifestParsedData,
  LevelSwitchedData,
  Level as HlsJsLevel,
  // Events, ErrorTypes, ErrorDetails
} from 'hls.js';
import type { PlayerPlugin, MediaSource, PluginLoadOptions, PluginMediaControlHandlers, PluginSelectableOption, PluginApi } from '../types';

export class HlsJsPlugin implements PlayerPlugin {
  public name = 'HlsJsPlugin';
  private hlsInstance: Hls | null = null;
  private mediaElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private pluginApi: PluginApi | null = null;
  private eventListeners: Array<{ event: string, handler: EventListenerOrEventListenerObject }> = [];
  private hlsEventListeners: Array<{ event: Events, handler: (eventName: string, data: any) => void }> = [];
  private hlsLevels: HlsJsLevel[] = [];
  private unregisterHooks: (() => void)[] = [];


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
    pluginApi: PluginApi,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers> {
    this.onTrackUnload(); 

    if (!Hls || !Hls.isSupported()) {
      pluginApi.events.callHook('plugin:error', { message: 'HLS.js is not supported or not loaded correctly.', fatal: true });
      throw new Error('HLS.js is not supported or not loaded correctly.');
    }

    // Example of a plugin subscribing to a core hook and managing its lifecycle.
    const unregister = pluginApi.hooks.hook('player:pause', () => {
        console.log('[HlsJsPlugin] Reacting to player:pause hook.');
    });
    this.unregisterHooks.push(unregister);

    this.pluginApi = pluginApi;
    this.currentContainer = options.containerElement;
    this.hlsLevels = []; 

    this.mediaElement = document.createElement(source.mediaType === 'audio' ? 'audio' : 'video') as HTMLVideoElement | HTMLAudioElement;
    this.mediaElement.setAttribute('playsinline', 'true');
    this.mediaElement.controls = false;
    this.mediaElement.volume = options.initialVolume;
    this.mediaElement.muted = options.initialMute;

    if (this.mediaElement instanceof HTMLVideoElement) {
      (this.mediaElement as HTMLVideoElement).poster = source.src.startsWith('blob:') ? '' : (document.querySelector(`[data-src="${source.src}"]`) as HTMLVideoElement)?.poster || '';
    }

    this._attachMediaElementEventListeners(this.mediaElement, pluginApi);

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

    this._attachHlsEventListeners(this.hlsInstance, pluginApi);

    this.hlsInstance.loadSource(source.src);
    this.hlsInstance.attachMedia(this.mediaElement);

    if (this.currentContainer) {
      this.currentContainer.appendChild(this.mediaElement);
      if (this.mediaElement instanceof HTMLVideoElement) {
        this.mediaElement.style.width = '100%';
        this.mediaElement.style.height = '100%';
        this.mediaElement.style.objectFit = 'contain';
      }
    } else {
      pluginApi.events.callHook('plugin:error', { message: 'HlsJsPlugin: Container element not provided.', fatal: true });
      throw new Error('Container element not provided for HlsJsPlugin');
    }

    if (options.autoplay && this.mediaElement) {
      this.mediaElement.play().catch(err => {
        console.warn(`HlsJsPlugin: Autoplay prevented for ${source.src}`, err);
        pluginApi.events.callHook('plugin:paused');
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
          this.pluginApi?.events.callHook('plugin:volumechange', { volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
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
              console.warn(`HlsJsPlugin: Invalid level ID received: ${optionId}`);
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
    pluginApi: PluginApi
  ): void {
    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
      mediaEl.addEventListener(event, handler);
      this.eventListeners.push({ event, handler });
    };

    add('loadstart', () => pluginApi.events.callHook('plugin:loading'));
    add('loadedmetadata', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) pluginApi.events.callHook('plugin:loadedmetadata', { duration: mediaEl.duration }); });
    add('canplay', () => pluginApi.events.callHook('plugin:canplay'));
    add('playing', () => pluginApi.events.callHook('plugin:playing'));
    add('pause', () => pluginApi.events.callHook('plugin:paused'));
    add('ended', () => pluginApi.events.callHook('plugin:ended'));
    add('timeupdate', () => pluginApi.events.callHook('plugin:timeupdate', { currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) pluginApi.events.callHook('plugin:durationchange', { duration: mediaEl.duration }); });
    add('error', () => {
      const error = mediaEl.error;
      pluginApi.events.callHook('plugin:error', {
        message: `HTMLMediaElement error: Code ${error?.code || 'unknown'} - ${error?.message || 'No message'}`,
        fatal: true,
        details: error
      });
    });
    add('waiting', () => pluginApi.events.callHook('plugin:waiting'));
    add('stalled', () => pluginApi.events.callHook('plugin:stalled'));
    add('volumechange', () => {
      pluginApi.events.callHook('plugin:volumechange', { volume: mediaEl.volume, isMuted: mediaEl.muted });
    });
    this.mediaElement = mediaEl;
  }

  private _attachHlsEventListeners(hls: Hls, pluginApi: PluginApi): void {
    const addHls = (event: Events, handler: (eventName: string, data: any) => void) => {
      hls.on(event, handler);
      this.hlsEventListeners.push({ event, handler });
    };

    addHls(Events.MANIFEST_LOADING, () => pluginApi.events.callHook('plugin:loading'));

    addHls(Events.MANIFEST_PARSED, (_event, _data: ManifestParsedData) => {
      if (hls.levels) {
        this.hlsLevels = [...hls.levels]; 
        pluginApi.events.callHook('plugin:optionsavailable', this._mapHlsLevelsToOptions(this.hlsLevels));
      }
      const initialActiveId = hls.autoLevelEnabled ? 'auto' : hls.currentLevel.toString();
      pluginApi.events.callHook('plugin:optionchanged', initialActiveId);
    });

    addHls(Events.LEVEL_SWITCHED, (_event, data: LevelSwitchedData) => {
      const activeId = hls.autoLevelEnabled ? 'auto' : data.level.toString();
      pluginApi.events.callHook('plugin:optionchanged', activeId);
    });

    addHls(Events.ERROR, (_event, data: ErrorData) => {
      if (!this.hlsInstance) return;
      const errorDetailsMessage = `HLS Error: ${data.details} (type: ${data.type})`;

      if (data.type === ErrorTypes.MEDIA_ERROR) {
        if (data.fatal) {
          if (data.details === ErrorDetails.BUFFER_STALLED_ERROR || data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
            this.hlsInstance.recoverMediaError();
          }
          pluginApi.events.callHook('plugin:error', { message: errorDetailsMessage, fatal: true, details: data });
        } else {
          if (data.details === ErrorDetails.BUFFER_STALLED_ERROR) pluginApi.events.callHook('plugin:stalled');
          else if (data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) pluginApi.events.callHook('plugin:waiting');
          else pluginApi.events.callHook('plugin:waiting');
        }
      } else if (data.type === ErrorTypes.NETWORK_ERROR) {
        if (data.fatal) {
          pluginApi.events.callHook('plugin:error', { message: errorDetailsMessage, fatal: true, details: data });
        } else {
          pluginApi.events.callHook('plugin:waiting');
        }
      } else {
        pluginApi.events.callHook('plugin:error', { message: errorDetailsMessage, fatal: data.fatal, details: data });
      }
    });
  }

  onTrackUnload(): void {
    this.unregisterHooks.forEach(unhook => unhook());
    this.unregisterHooks = [];

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
    this.pluginApi = null;
    this.hlsLevels = [];
  }

  destroy(): void {
    this.onTrackUnload();
  }
}
