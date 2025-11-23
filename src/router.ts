import type { LanguageModel } from 'ai';
import type { AIRouter, RouterConfig, RouterRequest } from './types.js';

/**
 * Internal router implementation class.
 */
class Router<T extends string = string> implements AIRouter<T> {
  private models: Record<T, LanguageModel>;
  private selectFn: (request: RouterRequest) => T;

  constructor(config: RouterConfig<T>) {
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

  selectModel(request: Partial<RouterRequest>): LanguageModel {
    const normalizedRequest: RouterRequest = {
      prompt: request.prompt ?? '',
      messages: request.messages ?? [],
      ...request,
    };

    const selectedTier = this.selectFn(normalizedRequest);

    if (!(selectedTier in this.models)) {
      throw new Error(
        `Selected tier "${selectedTier}" does not exist in models. Available tiers: ${this.getTiers().join(', ')}`
      );
    }

    return this.models[selectedTier];
  }

  getModel(tier: T): LanguageModel | undefined {
    return this.models[tier];
  }

  getTiers(): T[] {
    return Object.keys(this.models) as T[];
  }
}

/**
 * Create a new AI router
 *
 * @template T - Union type of tier name strings
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
export function createRouter<const T extends Record<string, LanguageModel>>(config: {
  models: T;
  select: (request: RouterRequest) => keyof T;
}): AIRouter<keyof T & string> {
  return new Router(config as RouterConfig<keyof T & string>);
}
