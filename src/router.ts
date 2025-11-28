import type { LanguageModelV1, LanguageModelV1CallOptions } from 'ai';
import type {
  RouterConfig,
  RouterRequest,
  RetryConfig,
  ArrayRouterConfig,
  ModelOrChain,
} from './types.js';

/**
 * Error thrown when response validation fails.
 * Allows retry/fallback logic to handle 200 OK responses with error bodies.
 */
export class ResponseValidationError extends Error {
  readonly response: unknown;

  constructor(response: unknown, message?: string) {
    super(message ?? 'Response validation failed');
    this.name = 'ResponseValidationError';
    this.response = response;
  }
}

/**
 * Default retry configuration applied when no config is specified
 */
const DEFAULT_RETRY_CONFIG: Required<
  Omit<
    RetryConfig,
    'onRetry' | 'onMaxRetriesExceeded' | 'onFallback' | 'onInvalidResponse' | 'validateResponse'
  >
> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    // Always retry ResponseValidationError (from validateResponse returning false)
    if (error instanceof ResponseValidationError) {
      return true;
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('overloaded')
      );
    }
    return false;
  },
};

/**
 * Normalizes a model or chain to always be an array
 */
function normalizeToChain(modelOrChain: ModelOrChain): LanguageModelV1[] {
  return Array.isArray(modelOrChain) ? modelOrChain : [modelOrChain];
}

/**
 * Internal router implementation that acts as a LanguageModel.
 * Delegates all calls to the selected model based on the routing logic.
 */
class RouterModel<T extends string = string> implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly defaultObjectGenerationMode = 'json' as const;

  private models: Record<T, LanguageModelV1[]>;
  private selectFn: (request: RouterRequest) => T;
  private retryConfig: RetryConfig | false;

  constructor(config: RouterConfig<T>) {
    // Normalize all models to chains
    this.models = {} as Record<T, LanguageModelV1[]>;
    for (const [key, value] of Object.entries(config.models) as [T, ModelOrChain][]) {
      this.models[key] = normalizeToChain(value);
    }

    this.selectFn = config.select;
    this.retryConfig = config.retry ?? { ...DEFAULT_RETRY_CONFIG };
    this.validateConfig();

    // Use first model's provider/id as defaults
    const firstChain = Object.values(this.models)[0] as LanguageModelV1[];
    const firstModel = firstChain[0];
    this.provider = firstModel.provider ?? 'ai-sdk-router';
    this.modelId = `router(${Object.keys(this.models).join('|')})`;
  }

  private validateConfig(): void {
    if (!this.models || Object.keys(this.models).length === 0) {
      throw new Error('Router configuration must include at least one model');
    }

    if (!this.selectFn || typeof this.selectFn !== 'function') {
      throw new Error('Router configuration must include a select function');
    }

    // Validate each chain has at least one model
    for (const [key, chain] of Object.entries(this.models) as [T, LanguageModelV1[]][]) {
      if (!chain || chain.length === 0) {
        throw new Error(`Route "${key}" must have at least one model`);
      }
    }
  }

  private selectModelChain(options: LanguageModelV1CallOptions): {
    chain: LanguageModelV1[];
    route: T;
  } {
    // Extract request information from the call options
    const request: RouterRequest = {};

    // Extract prompt text from the first message
    if (options.prompt?.[0]?.content) {
      const firstContent = options.prompt[0].content[0];
      if (
        firstContent &&
        typeof firstContent !== 'string' &&
        'type' in firstContent &&
        firstContent.type === 'text'
      ) {
        request.prompt = firstContent.text;
      }
    }

    // Extract messages
    if (options.prompt) {
      request.messages = options.prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
    }

    const selectedRoute = this.selectFn(request);

    if (!(selectedRoute in this.models)) {
      throw new Error(
        `Selected route "${selectedRoute}" does not exist in models. Available routes: ${Object.keys(this.models).join(', ')}`
      );
    }

    return { chain: this.models[selectedRoute], route: selectedRoute };
  }

  private getRetryConfig(): RetryConfig | undefined {
    if (this.retryConfig === false) {
      return undefined;
    }
    return this.retryConfig;
  }

  private async withFallbackChain<TResult>(
    chain: LanguageModelV1[],
    fn: (model: LanguageModelV1) => Promise<TResult> | PromiseLike<TResult>,
    retryConfig?: RetryConfig
  ): Promise<TResult> {
    let lastError: unknown;

    for (let modelIndex = 0; modelIndex < chain.length; modelIndex++) {
      const model = chain[modelIndex];
      const isLastModel = modelIndex === chain.length - 1;

      try {
        // Try to execute with this model, with retries
        return await this.withRetry(() => fn(model), retryConfig, isLastModel);
      } catch (error) {
        lastError = error;

        // If not the last model, try fallback
        if (!isLastModel) {
          const nextModel = chain[modelIndex + 1];
          retryConfig?.onFallback?.(error, model, nextModel);
          continue;
        }

        // Last model exhausted, throw the error
        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  private async withRetry<TResult>(
    fn: () => Promise<TResult> | PromiseLike<TResult>,
    retryConfig?: RetryConfig,
    isLastModel: boolean = true
  ): Promise<TResult> {
    if (!retryConfig) {
      return Promise.resolve(fn());
    }

    const {
      maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
      initialDelay = DEFAULT_RETRY_CONFIG.initialDelay,
      maxDelay = DEFAULT_RETRY_CONFIG.maxDelay,
      backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
      shouldRetry = DEFAULT_RETRY_CONFIG.shouldRetry,
      validateResponse,
      onRetry,
      onMaxRetriesExceeded,
      onInvalidResponse,
    } = retryConfig;

    let lastError: unknown;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const result = await Promise.resolve(fn());

        // Validate response if validator is provided
        if (validateResponse && !validateResponse(result)) {
          onInvalidResponse?.(result, attempt);
          throw new ResponseValidationError(result);
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        // If we've exhausted retries, call callback and throw/continue to fallback
        if (attempt > maxRetries) {
          if (isLastModel) {
            onMaxRetriesExceeded?.(error, attempt);
          }
          throw error;
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
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  doGenerate(options: LanguageModelV1CallOptions) {
    const { chain } = this.selectModelChain(options);
    const retryConfig = this.getRetryConfig();
    return this.withFallbackChain(chain, (model) => model.doGenerate(options), retryConfig);
  }

  doStream(options: LanguageModelV1CallOptions) {
    const { chain } = this.selectModelChain(options);
    const retryConfig = this.getRetryConfig();
    return this.withFallbackChain(chain, (model) => model.doStream(options), retryConfig);
  }
}

/**
 * Create a new AI SDK Router that acts as an AI SDK model
 *
 * Array only - simple fallback chain with default retry
 * @param models - Array of models forming a fallback chain
 * @returns A LanguageModelV1 that can be used directly with AI SDK functions
 *
 * @example
 * ```typescript
 * const model = createRouter([
 *   openai('gpt-4'),
 *   anthropic('claude-3-5-sonnet-20241022'),
 * ]);
 * ```
 */
export function createRouter(models: LanguageModelV1[]): LanguageModelV1;

/**
 * Create a new AI SDK Router that acts as an AI SDK model
 *
 * Array + config - fallback chain with custom retry
 * @param config - Configuration with models array and optional retry config
 * @returns A LanguageModelV1 that can be used directly with AI SDK functions
 *
 * @example
 * ```typescript
 * const model = createRouter({
 *   models: [openai('gpt-4'), anthropic('claude-3-5-sonnet-20241022')],
 *   retry: { maxRetries: 5 },
 * });
 * ```
 */
export function createRouter(config: ArrayRouterConfig): LanguageModelV1;

/**
 * Create a new AI SDK Router that acts as an AI SDK model
 *
 * Object with routes - routing + per-tier fallbacks
 * @param config - Router configuration with models map and select function
 * @returns A LanguageModelV1 that can be used directly with AI SDK functions
 *
 * @example
 * ```typescript
 * const model = createRouter({
 *   models: {
 *     fast: [openai('gpt-3.5-turbo'), openai('gpt-4')],
 *     deep: [anthropic('claude-3-5-sonnet-20241022')],
 *   },
 *   select: (request) => {
 *     if (request.prompt && request.prompt.length > 1000) return 'deep';
 *     return 'fast';
 *   },
 * });
 * ```
 */
export function createRouter<const T extends Record<string, ModelOrChain>>(config: {
  models: T;
  select: (request: RouterRequest) => keyof T;
  retry?: RetryConfig | false;
}): LanguageModelV1;

// Implementation
export function createRouter<const T extends Record<string, ModelOrChain>>(
  configOrModels:
    | LanguageModelV1[]
    | ArrayRouterConfig
    | {
        models: T;
        select: (request: RouterRequest) => keyof T;
        retry?: RetryConfig | false;
      }
): LanguageModelV1 {
  // Array only - simple fallback chain
  if (Array.isArray(configOrModels)) {
    return new RouterModel({
      models: { default: configOrModels } as Record<'default', ModelOrChain>,
      select: () => 'default',
    } as RouterConfig<'default'>);
  }

  // Array + config (models is an array)
  if (Array.isArray(configOrModels.models)) {
    const arrayConfig = configOrModels as ArrayRouterConfig;
    return new RouterModel({
      models: { default: arrayConfig.models } as Record<'default', ModelOrChain>,
      select: () => 'default',
      retry: arrayConfig.retry,
    } as RouterConfig<'default'>);
  }

  // Object with routes
  return new RouterModel(configOrModels as RouterConfig<keyof T & string>);
}
