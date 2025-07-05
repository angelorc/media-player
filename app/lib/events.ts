import type { PlayerEventBus, PlayerEventMap } from './types';

/**
 * Creates a simple, type-safe event emitter.
 */
export function createEventBus(): PlayerEventBus {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const listeners: Map<keyof PlayerEventMap, Set<Function>> = new Map();

  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    },

    off(event, callback) {
      if (listeners.has(event)) {
        listeners.get(event)!.delete(callback);
      }
    },

    emit(event, payload) {
      if (listeners.has(event)) {
        listeners.get(event)!.forEach((callback) => {
          try {
            callback(payload);
          } catch (e) {
            console.error(`Error in event handler for '${event}':`, e);
          }
        });
      }
    },
  };
}