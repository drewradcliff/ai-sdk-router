import type { LanguageModelV1, LanguageModelV1CallOptions } from 'ai';
import type { RouterConfig, RouterRequest, RetryConfig } from './types.js';

/**
 * Internal router implementation that acts as a LanguageModel.
 * Delegates all calls to the selected model based on the routing logic.
 */
class RouterModel<T extends string = string> implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly defaultObjectGenerationMode = 'json' as const;

  private models: Record<T, LanguageModelV1>;
  private selectFn: (request: RouterRequest) => T;
  private retryConfig?: RouterConfig<T>['retry'];

  constructor(config: RouterConfig<T>) {
    this.models = config.models;
    this.selectFn = config.select;
    this.retryConfig = config.retry;
    this.validateConfig();

    // Use first model's provider/id as defaults
    const firstModel = Object.values(this.models)[0] as LanguageModelV1;
    this.provider = firstModel.provider ?? 'ai-router';
    this.modelId = `router(${Object.keys(this.models).join('|')})`;
  }

  private validateConfig(): void {
    if (!this.models || Object.keys(this.models).length === 0) {
      throw new Error('Router configuration must include at least one model');
    }

    if (!this.selectFn || typeof this.selectFn !== 'function') {
      throw new Error('Router configuration must include a select function');
    }
  }

  private selectModel(options: LanguageModelV1CallOptions): { model: LanguageModelV1; route: T } {
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

    return { model: this.models[selectedRoute], route: selectedRoute };
  }

  private getRetryConfig(route: T): RetryConfig | undefined {
    if (!this.retryConfig) {
      return undefined;
    }

    // Check if it's a per-model config
    if ('default' in this.retryConfig || route in this.retryConfig) {
      const perModelConfig = this.retryConfig as Record<T | 'default', RetryConfig>;
      return perModelConfig[route] ?? perModelConfig.default;
    }

    // Otherwise it's a global config
    return this.retryConfig as RetryConfig;
  }

  private async withRetry<TResult>(
    fn: () => Promise<TResult> | PromiseLike<TResult>,
    retryConfig?: RetryConfig
  ): Promise<TResult> {
    if (!retryConfig) {
      return Promise.resolve(fn());
    }

    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      shouldRetry = () => true,
      onRetry,
      onMaxRetriesExceeded,
    } = retryConfig;

    let lastError: unknown;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await Promise.resolve(fn());
      } catch (error) {
        lastError = error;
        attempt++;

        // If we've exhausted retries, throw
        if (attempt > maxRetries) {
          onMaxRetriesExceeded?.(error, attempt);
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
    const { model, route } = this.selectModel(options);
    const retryConfig = this.getRetryConfig(route);
    return this.withRetry(() => model.doGenerate(options), retryConfig);
  }

  doStream(options: LanguageModelV1CallOptions) {
    const { model, route } = this.selectModel(options);
    const retryConfig = this.getRetryConfig(route);
    return this.withRetry(() => model.doStream(options), retryConfig);
  }
}

/**
 * Create a new AI router that acts as an AI SDK model
 *
 * @template T - The models record type (automatically inferred)
 * @param config - Router configuration with models and select function
 * @returns A LanguageModelV1 that can be used directly with AI SDK functions
 *
 * @example
 * ```typescript
 * import { createRouter } from 'ai-router';
 * import { openai } from '@ai-sdk/openai';
 * import { anthropic } from '@ai-sdk/anthropic';
 * import { generateText } from 'ai';
 *
 * const model = createRouter({
 *   models: {
 *     fast: openai('gpt-3.5-turbo'),
 *     deep: anthropic('claude-3-5-sonnet-20241022'),
 *   },
 *   select: (request) => {
 *     if (request.prompt && request.prompt.length > 1000) return 'deep';
 *     return 'fast';
 *   },
 * });
 *
 * // Use directly with AI SDK
 * const result = await generateText({
 *   model,
 *   prompt: 'Hello!'
 * });
 * ```
 */
export function createRouter<const T extends Record<string, LanguageModelV1>>(config: {
  models: T;
  select: (request: RouterRequest) => keyof T;
  retry?: RetryConfig | (Record<keyof T | 'default', RetryConfig> & { default?: RetryConfig });
}): LanguageModelV1 {
  return new RouterModel(config as RouterConfig<keyof T & string>);
}
