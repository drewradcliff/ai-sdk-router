/**
 * ai-router: type-safe model router
 *
 * @module ai-router
 */

export { createRouter } from './router.js';
export type { AIRouter, RouterConfig, RouterRequest } from './types.js';

// Retry utilities
export { retry, MaxRetriesExceededError } from './utils/retry.js';
export type { RetryOptions } from './utils/retry.js';
