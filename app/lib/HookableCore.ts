import { Hookable } from 'hookable';

/**
 * A dedicated, reusable class that encapsulates hookable functionality.
 * This uses composition to wrap a `Hookable` instance, providing a clean API
 * and allowing for custom methods like `removeAllHooks`.
 */
export class HookableCore {
  private _hookable: Hookable;

  constructor() {
    this._hookable = new Hookable();
  }

  /**
   * Registers a hook listener.
   * @param name - The name of the hook.
   * @param fn - The function to call when the hook is triggered.
   * @returns An `unhook` function to remove the listener.
   */
  public hook(name: string, fn: (...args: any[]) => void | Promise<void>): () => void {
    return this._hookable.hook(name, fn as any);
  }

  /**
   * Calls all listeners for a given hook.
   * @param name - The name of the hook to call.
   * @param args - Arguments to pass to the hook listeners.
   */
  public callHook(name: string, ...args: any[]): Promise<void> {
    return this._hookable.callHook(name, ...args);
  }

  /**
   * Removes all registered listeners from this instance.
   */
  public removeAllHooks(): void {
    // The simplest way to remove all hooks is to replace the hookable instance.
    this._hookable = new Hookable();
  }
}
