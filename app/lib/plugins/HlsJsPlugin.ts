import Hls, { Events, ErrorTypes, ErrorDetails } from 'hls.js';
import type {
  HlsConfig,
  ErrorData,
  ManifestParsedData,
  LevelSwitchedData,
  Level as HlsJsLevel 
} from 'hls.js';
import type { PlayerPlugin, MediaSource, PluginLoadOptions, PluginMediaControlHandlers, PluginSelectableOption } from '../types';
import type { PlayerStateStore } from '../state/PlayerStateStore';

export class HlsJsPlugin implements PlayerPlugin {
  public name = 'HlsJsPlugin';
  private hlsInstance: Hls | null = null;
  private mediaElement: HTMLVideoElement | HTMLAudioElement | null = null;
  private currentContainer: HTMLElement | null = null;
  private stateStore: PlayerStateStore | null = null;
  private eventListeners: Array<{ event: string, handler: EventListenerOrEventListenerObject }> = [];
  private hlsEventListeners: Array<{ event: Events, handler: (eventName: string, data: any) => void }> = [];
  private hlsLevels: HlsJsLevel[] = [];


  isTypeSupported = (source: MediaSource): boolean => {
    return source.format.toLowerCase() === 'hls' && Hls && Hls.isSupported();
  }

  private _mapHlsLevelsToOptions = (levels: HlsJsLevel[]): PluginSelectableOption[] => {
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

  load = (
    source: MediaSource,
    stateStore: PlayerStateStore,
    options: PluginLoadOptions
  ): Promise<PluginMediaControlHandlers> => {
    return new Promise<PluginMediaControlHandlers>((resolve, reject) => {
        this.onTrackUnload(); 
    
        if (!Hls || !Hls.isSupported()) {
          const msg = 'HLS.js is not supported or not loaded correctly.';
          stateStore.reportError(msg);
          reject(new Error(msg));
          return;
        }

        const hlsConfig: Partial<HlsConfig> = { /* ... hls config ... */ };
        const hlsInstance = new Hls(hlsConfig);
        this.hlsInstance = hlsInstance;

        const loadTimeout = setTimeout(() => {
            console.error('HlsPlugin: Loading timed out.');
            cleanupInitialListeners();
            reject(new Error('HLS loading timed out.'));
        }, 5000); // 5 seconds timeout
    
        this.stateStore = stateStore;
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
    
        const cleanupInitialListeners = () => {
            clearTimeout(loadTimeout);
            hlsInstance.off(Events.MANIFEST_PARSED, onManifestParsed);
            hlsInstance.off(Events.ERROR, onInitialError);
        };

        const onInitialError = (_event: string, data: ErrorData) => {
            if (data.fatal) {
                cleanupInitialListeners();
                const errorDetailsMessage = `HLS Error: ${data.details} (type: ${data.type})`;
                reject(new Error(errorDetailsMessage));
            }
        };

        const onManifestParsed = (_event: string, data: ManifestParsedData) => {
            cleanupInitialListeners();

            // Populate quality options immediately upon parsing the manifest.
            if (hlsInstance.levels) {
                this.hlsLevels = [...hlsInstance.levels];
                stateStore.reportPluginOptionsAvailable(this._mapHlsLevelsToOptions(this.hlsLevels));
                const initialActiveId = hlsInstance.autoLevelEnabled ? 'auto' : hlsInstance.currentLevel.toString();
                stateStore.reportPluginOptionChanged(initialActiveId);
            }

            // Manifest is good, now we can attach full listeners and resolve
            this._attachHlsEventListeners(hlsInstance, stateStore);
            this._attachMediaElementEventListeners(this.mediaElement!, stateStore);
            hlsInstance.attachMedia(this.mediaElement!);

            if (this.currentContainer) {
              this.currentContainer.appendChild(this.mediaElement!);
              if (this.mediaElement instanceof HTMLVideoElement) {
                this.mediaElement.style.width = '100%';
                this.mediaElement.style.height = '100%';
                this.mediaElement.style.objectFit = 'contain';
              }
            } else {
              const msg = 'HlsPlugin: Container element not provided.';
              stateStore.reportError(msg);
              reject(new Error(msg));
              return;
            }
    
            if (options.autoplay && this.mediaElement) {
              this.mediaElement.play().catch(err => {
                console.warn(`HlsPlugin: Autoplay prevented for ${source.src}`, err);
                stateStore.reportPaused();
              });
            }

            resolve({
                play: async () => { if (this.mediaElement) await this.mediaElement.play(); },
                pause: () => { if (this.mediaElement) this.mediaElement.pause(); },
                stop: () => { 
                  if (this.hlsInstance) this.hlsInstance.stopLoad();
                  if (this.mediaElement) {
                    this.mediaElement.pause();
                    this.mediaElement.removeAttribute('src'); 
                    this.mediaElement.load(); 
                  }
                },
                seek: (time: number) => { if (this.mediaElement) { this.mediaElement.currentTime = time; } },
                setVolume: (volume: number, isMuted: boolean) => {
                  if (this.mediaElement) {
                    this.mediaElement.volume = volume;
                    this.mediaElement.muted = isMuted;
                    this.stateStore?.reportVolumeChange({ volume: this.mediaElement.volume, isMuted: this.mediaElement.muted });
                  }
                },
                getHTMLElement: () => this.mediaElement,
                setPluginOption: async (optionId: string) => {
                  if (this.hlsInstance && this.stateStore) {
                    // Optimistically update the UI state.
                    this.stateStore.reportPluginOptionChanged(optionId);

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
            });
        };

        hlsInstance.on(Events.ERROR, onInitialError);
        hlsInstance.on(Events.MANIFEST_PARSED, onManifestParsed);
        hlsInstance.loadSource(source.src);
    });
  }

  private _removeEventListeners = (): void => {
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

  private _attachMediaElementEventListeners = (
    mediaEl: HTMLAudioElement | HTMLVideoElement,
    stateStore: PlayerStateStore
  ): void => {
    const add = (event: string, handler: EventListenerOrEventListenerObject) => {
      mediaEl.addEventListener(event, handler);
      this.eventListeners.push({ event, handler });
    };

    add('loadstart', () => stateStore.reportLoading());
    add('loadedmetadata', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) stateStore.reportLoadedMetadata({ duration: mediaEl.duration }); });
    add('canplay', () => stateStore.reportCanPlay());
    add('playing', () => stateStore.reportPlaying());
    add('pause', () => stateStore.reportPaused());
    add('ended', () => stateStore.reportEnded());
    add('timeupdate', () => stateStore.reportTimeUpdate({ currentTime: mediaEl.currentTime, duration: mediaEl.duration }));
    add('durationchange', () => { if (mediaEl.duration && mediaEl.duration !== Infinity) stateStore.reportDurationChange({ duration: mediaEl.duration }); });
    add('error', () => {
      const error = mediaEl.error;
      stateStore.reportError(`HTMLMediaElement error: Code ${error?.code || 'unknown'} - ${error?.message || 'No message'}`);
    });
    add('waiting', () => stateStore.reportWaiting());
    add('stalled', () => stateStore.reportStalled());
    add('volumechange', () => {
      stateStore.reportVolumeChange({ volume: mediaEl.volume, isMuted: mediaEl.muted });
    });
    this.mediaElement = mediaEl;
  }

  private _attachHlsEventListeners = (hls: Hls, stateStore: PlayerStateStore): void => {
    const addHls = (event: Events, handler: (eventName: string, data: any) => void) => {
      hls.on(event, handler);
      this.hlsEventListeners.push({ event, handler });
    };

    addHls(Events.MANIFEST_LOADING, () => stateStore.reportLoading());

    // We already handled MANIFEST_PARSED to resolve the load promise, but we re-attach
    // to update options if the manifest is reloaded (e.g. for live streams).
    addHls(Events.MANIFEST_PARSED, (_event, _data: ManifestParsedData) => {
      if (hls.levels) {
        this.hlsLevels = [...hls.levels]; 
        stateStore.reportPluginOptionsAvailable(this._mapHlsLevelsToOptions(this.hlsLevels));
      }
      const initialActiveId = hls.autoLevelEnabled ? 'auto' : hls.currentLevel.toString();
      stateStore.reportPluginOptionChanged(initialActiveId);
    });

    addHls(Events.LEVEL_SWITCHED, (_event, data: LevelSwitchedData) => {
      const activeId = hls.autoLevelEnabled ? 'auto' : data.level.toString();
      stateStore.reportPluginOptionChanged(activeId);
    });

    // This error handler is for non-fatal errors during playback
    addHls(Events.ERROR, (_event, data: ErrorData) => {
      if (!this.hlsInstance || data.fatal) return; // Fatal errors are handled during load
      const errorDetailsMessage = `HLS Error: ${data.details} (type: ${data.type})`;

      if (data.type === ErrorTypes.MEDIA_ERROR) {
          if (data.details === ErrorDetails.BUFFER_STALLED_ERROR || data.details === ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
            this.hlsInstance.recoverMediaError();
          } else {
             stateStore.reportWaiting();
          }
      } else if (data.type === ErrorTypes.NETWORK_ERROR) {
          stateStore.reportWaiting();
      } else {
        stateStore.reportError(errorDetailsMessage);
      }
    });
  }

  onTrackUnload = (): void => {
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
    this.stateStore = null;
    this.hlsLevels = [];
  }

  destroy = (): void => {
    this.onTrackUnload();
  }
}