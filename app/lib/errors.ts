/**
 * Base error class for all player-related errors.
 */
export class PlayerError extends Error {
  public code: string;

  constructor(message: string, code: string = 'GENERIC_ERROR') {
    super(message);
    this.name = 'PlayerError';
    this.code = code;
  }
}

/**
 * Error for when no suitable provider can be found for a given source.
 */
export class ProviderError extends PlayerError {
  constructor(source: string) {
    super(`No suitable provider found for source: ${source}`, 'PROVIDER_NOT_FOUND');
    this.name = 'ProviderError';
  }
}