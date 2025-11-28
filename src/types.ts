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
  /**
   * Function to validate a successful response. Return false to trigger retry/fallback.
   * Useful for handling APIs that return 200 OK with error bodies (like Anthropic's OVERLOADED_ERROR)
   */
  validateResponse?: (response: unknown) => boolean;
  /** Callback invoked before each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Callback invoked when all retries are exhausted */
  onMaxRetriesExceeded?: (error: unknown, attempts: number) => void;
  /** Callback invoked when falling back to the next model in a chain */
  onFallback?: (error: unknown, fromModel: LanguageModelV1, toModel: LanguageModelV1) => void;
  /** Callback invoked when validateResponse returns false */
  onInvalidResponse?: (response: unknown, attempt: number) => void;
};

/**
 * A single model or an array of models (fallback chain)
 */
export type ModelOrChain = LanguageModelV1 | LanguageModelV1[];

/**
 * Configuration object for creating a router with named routes.
 * @template T - Union of route name strings
 */
export type RouterConfig<T extends string = string> = {
  /** Map of route names to their corresponding AI SDK models or fallback chains */
  models: Record<T, ModelOrChain>;
  /** Selection function that determines which route to use based on the request */
  select: (request: RouterRequest) => T;
  /** Optional retry configuration applied globally to all models, or false to disable */
  retry?: RetryConfig | false;
};

/**
 * Configuration object for creating a router with a simple array of models (fallback chain).
 */
export type ArrayRouterConfig = {
  /** Array of models forming a fallback chain */
  models: LanguageModelV1[];
  /** Optional retry configuration, or false to disable */
  retry?: RetryConfig | false;
};
