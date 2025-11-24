import type { LanguageModelV1 } from 'ai';

/**
 * Request object passed to the router's select function.
 * Contains information about the AI request to help make routing decisions.
 */
export type RouterRequest = {
  /** The prompt string for single-turn completions */
  prompt?: string;
  /** Message array for multi-turn conversations */
  messages?: Array<{ role: string; content: string | unknown }>;
  /** Allow additional custom properties for flexible routing logic */
  [key: string]: unknown;
};

/**
 * Retry configuration for handling failures
 */
export type RetryConfig = {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if an error should trigger a retry */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback invoked before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Callback invoked when all retries are exhausted */
  onMaxRetriesExceeded?: (error: unknown, attempts: number) => void;
};

/**
 * Configuration object for creating a router.
 * @template T - Union of route name strings
 */
export type RouterConfig<T extends string = string> = {
  /** Map of route names to their corresponding AI SDK models */
  models: Record<T, LanguageModelV1>;
  /** Selection function that determines which route to use based on the request */
  select: (request: RouterRequest) => T;
  /**
   * Retry configuration - can be global or per-model
   * - Pass RetryConfig for global retry behavior
   * - Pass Record<T, RetryConfig> with 'default' key for per-model retry
   */
  retry?: RetryConfig | (Record<T | 'default', RetryConfig> & { default?: RetryConfig });
};
