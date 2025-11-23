import type { AIRouter, RouterConfig, RouterRequest } from './types.js';

/**
 * Internal router implementation class.
 */
class Router<T extends string = string, TModel = unknown> implements AIRouter<T, TModel> {
  private models: Record<T, TModel>;
  private selectFn: (request: RouterRequest) => T;

  constructor(config: RouterConfig<TModel, T>) {
    this.models = config.models;
    this.selectFn = config.select;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.models || Object.keys(this.models).length === 0) {
      throw new Error('Router configuration must include at least one model');
    }

    if (!this.selectFn || typeof this.selectFn !== 'function') {
      throw new Error('Router configuration must include a select function');
    }
  }

  selectModel(request: Partial<RouterRequest>): TModel {
    const normalizedRequest: RouterRequest = {
      prompt: request.prompt ?? '',
      messages: request.messages ?? [],
      ...request,
    };

    const selectedRoute = this.selectFn(normalizedRequest);

    if (!(selectedRoute in this.models)) {
      throw new Error(
        `Selected route "${selectedRoute}" does not exist in models. Available routes: ${this.getRoutes().join(', ')}`
      );
    }

    return this.models[selectedRoute];
  }

  getModel(route: T): TModel | undefined {
    return this.models[route];
  }

  getRoutes(): T[] {
    return Object.keys(this.models) as T[];
  }
}

/**
 * Create a new AI router
 *
 * @template TModel - The model type (automatically inferred from your models)
 * @template T - The models record type (automatically inferred)
 * @param config - Router configuration with models and select function
 * @returns AIRouter instance
 *
 * @example
 * ```typescript
 * import { createRouter } from 'ai-router';
 * import { openai } from '@ai-sdk/openai';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const router = createRouter({
 *   models: {
 *     fast: openai('gpt-3.5-turbo'),
 *     smart: openai('gpt-4-turbo'),
 *     deep: anthropic('claude-3-5-sonnet-20241022'),
 *   },
 *   select: (request) => {
 *     if (request.prompt.length > 1000) return 'deep';
 *     if (request.messages.length > 10) return 'smart';
 *     return 'fast';
 *   },
 * });
 *
 * // Use with AI SDK
 * import { generateText } from 'ai';
 *
 * const model = router.selectModel({ prompt: 'Hello!' });
 * const result = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export function createRouter<TModel, const T extends Record<string, TModel>>(config: {
  models: T;
  select: (request: RouterRequest) => keyof T;
}): AIRouter<keyof T & string, T[keyof T]> {
  return new Router(config as RouterConfig<T[keyof T], keyof T & string>);
}
