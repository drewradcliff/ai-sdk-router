/**
 * ai-router: model routing for ai-sdk
 *
 * @module ai-router
 */

export { createRouter } from './router.js';
export type { RouterConfig, RouterRequest } from './types.js';

// Retry utilities
export { retry, MaxRetriesExceededError } from './utils/retry.js';
export type { RetryOptions } from './utils/retry.js';
