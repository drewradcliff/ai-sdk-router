/**
 * Basic usage example for ai-router
 *
 * This example demonstrates how to set up a router with multiple models
 * and use it with the Vercel AI SDK.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { createRouter } from '../src/index.js';
import { generateText } from 'ai';
// @ts-expect-error - Example only, packages may not be installed
import { openai } from '@ai-sdk/openai';
// @ts-expect-error - Example only, packages may not be installed
import { anthropic } from '@ai-sdk/anthropic';

// Create router - it's a model that can be used directly with AI SDK
const model = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    // Route based on prompt length
    if (request.prompt && request.prompt.length > 1000) return 'deep';

    // Route based on message count
    if (request.messages && request.messages.length > 10) return 'smart';

    // Default to fast model
    return 'fast';
  },
});

// Example 1: Basic usage
async function example1() {
  const result = await generateText({
    model,
    prompt: 'Explain quantum computing in simple terms',
  });

  console.log('Example 1 - Short prompt (uses fast model):');
  console.log(result.text);
}

// Example 2: Using router-level retry for resilience
const modelWithRetry = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    if (request.prompt && request.prompt.length > 1000) return 'deep';
    if (request.messages && request.messages.length > 10) return 'smart';
    return 'fast';
  },
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    shouldRetry: (error) => {
      // Only retry on rate limit or timeout errors
      if (error instanceof Error) {
        return error.message.includes('rate limit') || error.message.includes('timeout');
      }
      return false;
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
    },
  },
});

async function example2() {
  // Retry is automatic - no wrapping needed!
  const result = await generateText({
    model: modelWithRetry,
    prompt: 'Write a detailed essay about renewable energy',
  });

  console.log('Example 2 - With router-level retry:');
  console.log(result.text);
}

// Run examples (uncomment to execute)
// example1();
// example2();
