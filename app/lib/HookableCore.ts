import { Hookable } from 'hookable';

export class HookableCore {
  private _hookable: Hookable;

  constructor() {
    this._hookable = new Hookable();
  }

  public hook(name: string, fn: (...args: any[]) => void | Promise<void>): () => void {
    return this._hookable.hook(name, fn as any);
  }

  public callHook(name: string, ...args: any[]): Promise<void> {
    return this._hookable.callHook(name, ...args);
  }

  public removeAllHooks(): void {
    this._hookable = new Hookable();
  }
}
