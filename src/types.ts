import type { LanguageModel } from 'ai';

/**
 * Request object passed to the router's select function.
 * Contains information about the AI request to help make routing decisions.
 */
export type RouterRequest = {
  /** The prompt string for single-turn completions */
  prompt: string;
  /** Message array for multi-turn conversations */
  messages: Array<{ role: string; content: string }>;
  /** Allow additional custom properties for flexible routing logic */
  [key: string]: unknown;
};

/**
 * Configuration object for creating a router.
 * @template T - Union of tier name strings
 */
export type RouterConfig<T extends string = string> = {
  /** Map of tier names to their corresponding language models */
  models: Record<T, LanguageModel>;
  /** Selection function that determines which tier to use based on the request */
  select: (request: RouterRequest) => T;
};

/**
 * AI Router interface for selecting models based on request characteristics.
 * @template T - Union of tier name strings
 */
export interface AIRouter<T extends string = string> {
  /**
   * Select a model based on the request using the configured selection logic.
   * @param request - Request information to base the selection on
   * @returns The selected language model
   */
  selectModel(request: Partial<RouterRequest>): LanguageModel;

  /**
   * Directly get a model by its tier name.
   * @param tier - The tier name to retrieve
   * @returns The language model for that tier, or undefined if not found
   */
  getModel(tier: T): LanguageModel | undefined;

  /**
   * Get a list of all available tier names.
   * @returns Array of tier names
   */
  getTiers(): T[];
}
