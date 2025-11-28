/**
 * ai-sdk-router: model routing for ai-sdk
 *
 * @module ai-sdk-router
 */

export { createRouter, ResponseValidationError } from './router.js';
export type {
  RouterConfig,
  RouterRequest,
  RetryConfig,
  ArrayRouterConfig,
  ModelOrChain,
} from './types.js';
