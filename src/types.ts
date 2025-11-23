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
 * @template TModel - The model type (e.g., LanguageModel from AI SDK)
 * @template T - Union of route name strings
 */
export type RouterConfig<TModel, T extends string = string> = {
  /** Map of route names to their corresponding models */
  models: Record<T, TModel>;
  /** Selection function that determines which route to use based on the request */
  select: (request: RouterRequest) => T;
};

/**
 * AI Router interface for selecting models based on request characteristics.
 * @template T - Union of route name strings
 * @template TModel - The model type (e.g., LanguageModel from AI SDK)
 */
export interface AIRouter<T extends string = string, TModel = unknown> {
  /**
   * Select a model based on the request using the configured selection logic.
   * @param request - Request information to base the selection on
   * @returns The selected model
   */
  selectModel(request: Partial<RouterRequest>): TModel;

  /**
   * Directly get a model by its route name.
   * @param route - The route name to retrieve
   * @returns The model for that route, or undefined if not found
   */
  getModel(route: T): TModel | undefined;

  /**
   * Get a list of all available route names.
   * @returns Array of route names
   */
  getRoutes(): T[];
}
