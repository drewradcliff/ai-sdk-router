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
 * Configuration object for creating a router.
 * @template T - Union of route name strings
 */
export type RouterConfig<T extends string = string> = {
  /** Map of route names to their corresponding AI SDK models */
  models: Record<T, LanguageModelV1>;
  /** Selection function that determines which route to use based on the request */
  select: (request: RouterRequest) => T;
};
