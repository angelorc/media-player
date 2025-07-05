import { createEventBus } from './events';
import { createPlayerStore } from './store';
import { ProviderManager } from './providers/manager';
import type {
  PlayerOptions,
  PlayerContext,
  PlayerEventMap,
} from './types';

export class Player {
  public readonly context: PlayerContext;
  private container: HTMLElement;

  constructor(options: PlayerOptions) {
    this.container = options.container;

    // 1. Create all core modules
    const store = createPlayerStore();
    const events = createEventBus();
    
    // 2. Build the context object
    this.context = {
      store,
      events,
      player: this,
      // ProviderManager will be created here but needs the context,
      // so we will initialize it right after.
      providers: null as any, 
    };

    // 3. Initialize the provider manager with the full context
    this.context.providers = new ProviderManager(
      this.context,
      this.container,
      options.providers
    );

    this.setupQueueAutoAdvance();

    // 4. Initial load if a source is provided
    if (options.source) {
      this.load(options.source);
    }
  }

  private setupQueueAutoAdvance(): void {
    // Correctly subscribe to the store. The listener receives the entire
    // new state and the previous state.
    this.context.store.subscribe(
      (state, prevState) => {
        // We manually compare the relevant part of the state to find the "rising edge"
        // This is when isEnded flips from false to true.
        if (state.isEnded && !prevState.isEnded) {
          console.log('Media ended, attempting to play next in queue...');
          this.next();
        }
      }
    );
  }

  private playItemAtIndex(index: number): void {
    const { queue } = this.context.store.getState();
    const source = queue[index];

    if (source) {
      // Update the store to reflect the new current index
      this.context.store.getState().actions.queue.jumpTo(index);
      // Now, tell the provider manager to load this specific source
      this.context.providers.loadSource(source);
      this.context.events.emit('source:change', { newSource: source });
    }
  }

  load(source: string | string[]): void {
    const { actions } = this.context.store.getState();

    if (Array.isArray(source)) {
      if (source.length === 0) {
        actions.queue.clear();
        // Potentially stop playback here
        return;
      }
      // Set the entire queue
      actions.queue.set(source);
      // Automatically play the first item
      this.playItemAtIndex(0);
    } else {
      // For a single source, we clear the queue and play it directly.
      actions.queue.clear();
      this.context.providers.loadSource(source);
      this.context.events.emit('source:change', { newSource: source });
    }
  }
  
  /** Subscribes to a player event. */
  on<K extends keyof PlayerEventMap>(
    event: K,
    callback: (payload: PlayerEventMap[K]) => void
  ) {
    this.context.events.on(event, callback);
  }

  /** Unsubscribes from a player event. */
  off<K extends keyof PlayerEventMap>(
    event: K,
    callback: (payload: PlayerEventMap[K]) => void
  ) {
    this.context.events.off(event, callback);
  }
  
  /** Destroys the player instance, cleaning up all resources. */
  destroy(): void {
    this.context.providers.destroy();
    // In future phases, we'd destroy plugins here too.
    this.context.events.emit('destroy', undefined);
  }
  
  // --- Media Controls ---
  // These are convenient shortcuts that delegate to the active provider.

  next(): void {
    const { goNext } = this.context.store.getState().actions.queue;
    const nextIndex = goNext(); // This action updates the index in the store
    if (nextIndex !== -1) {
      this.playItemAtIndex(nextIndex);
    }
  }

  previous(): void {
    const { goPrevious } = this.context.store.getState().actions.queue;
    const prevIndex = goPrevious(); // This action updates the index in the store
    if (prevIndex !== -1) {
      this.playItemAtIndex(prevIndex);
    }
  }

  jumpTo(index: number): void {
    // We check against the queue in the store to avoid invalid jumps
    const { queue } = this.context.store.getState();
    if (index >= 0 && index < queue.length) {
      this.playItemAtIndex(index);
    }
  }

  get addToQueue() { return this.context.store.getState().actions.queue.add; }
  get removeFromQueue() { return this.context.store.getState().actions.queue.remove; }
  get clearQueue() { return this.context.store.getState().actions.queue.clear; }

  get play() { return () => this.context.providers.getActiveProvider()?.play(); }
  get pause() { return () => this.context.providers.getActiveProvider()?.pause(); }
  get seek() { return (time: number) => this.context.providers.getActiveProvider()?.seek(time); }
  get setVolume() { return (volume: number) => this.context.providers.getActiveProvider()?.setVolume(volume); }
  get setMuted() { return (muted: boolean) => this.context.providers.getActiveProvider()?.setMuted(muted); }
}