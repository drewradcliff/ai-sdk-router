/**
 * Retry utility for AI generations with exponential backoff
 *
 * @module retry
 */

/**
 * Configuration options for the retry function
 */
export type RetryOptions = {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;

  /** Maximum delay in milliseconds between retries (default: 10000) */
  maxDelay?: number;

  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;

  /**
   * Function to determine if an error should trigger a retry
   * Returns true to retry, false to throw immediately
   * By default, retries all errors
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * Callback invoked before each retry attempt
   * Useful for logging or metrics
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;

  /**
   * Callback invoked when all retries are exhausted
   */
  onMaxRetriesExceeded?: (error: unknown, attempts: number) => void;
};

/**
 * Error class for when max retries are exceeded
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    public readonly lastError: unknown,
    public readonly attempts: number
  ) {
    super(
      `Max retries (${attempts}) exceeded. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Retry an async operation with configurable options
 *
 * @template T - The return type of the function
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's result
 *
 * @example
 * ```typescript
 * import { retry } from 'ai-router/utils';
 * import { generateText } from 'ai';
 *
 * const result = await retry(
 *   () => generateText({ model, prompt }),
 *   { maxRetries: 3 }
 * );
 * ```
 *
 * @example Advanced usage with callbacks
 * ```typescript
 * const result = await retry(
 *   () => generateText({ model, prompt }),
 *   {
 *     maxRetries: 5,
 *     initialDelay: 500,
 *     backoffMultiplier: 2,
 *     shouldRetry: (error, attempt) => {
 *       // Only retry on rate limit or timeout errors
 *       if (error instanceof Error) {
 *         return error.message.includes('rate limit') ||
 *                error.message.includes('timeout');
 *       }
 *       return false;
 *     },
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`, error);
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry,
    onMaxRetriesExceeded,
  } = options;

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // If we've exhausted retries, throw
      if (attempt > maxRetries) {
        onMaxRetriesExceeded?.(error, attempt);
        throw new MaxRetriesExceededError(error, attempt);
      }

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);

      // Call retry callback if provided
      onRetry?.(error, attempt, delay);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new MaxRetriesExceededError(lastError, attempt);
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
