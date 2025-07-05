import type { IProvider, IProviderConstructor, PlayerContext } from '../types';

export class ProviderManager {
  private context: PlayerContext;
  private container: HTMLElement;
  private availableProviders: IProviderConstructor[];
  private activeProvider: IProvider | null = null;

  constructor(context: PlayerContext, container: HTMLElement, providers: IProviderConstructor[]) {
    this.context = context;
    this.container = container;
    this.availableProviders = providers;
  }
  
  /** Finds a suitable provider, instantiates it, and loads the source. */
  loadSource(source: string) {
    const ProviderToUse = this.availableProviders.find(P => {
      // Temporarily instantiate to use the `canPlay` method.
      // This is a common pattern to access instance methods for checks.
      const instance = new P(this.context, this.container);
      return instance.canPlay(source);
    });

    if (!ProviderToUse) {
      // Handle error: no suitable provider found
      console.error(`No provider found for source: ${source}`);
      return;
    }

    // If we are changing sources, destroy the old provider first
    if (this.activeProvider) {
      this.activeProvider.destroy();
    }
    
    // Reset relevant parts of the store before loading new media
    this.context.store.getState().actions.media.reset();

    // Create and load the new provider
    this.activeProvider = new ProviderToUse(this.context, this.container);
    this.activeProvider.load(source);
  }

  /** Gets the currently active provider instance. */
  getActiveProvider(): IProvider | null {
    return this.activeProvider;
  }

  destroy() {
    this.activeProvider?.destroy();
    this.activeProvider = null;
  }
}