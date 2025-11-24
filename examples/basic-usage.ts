/**
 * Basic usage example for ai-router
 *
 * This example demonstrates how to set up a router with multiple models
 * and use it with the Vercel AI SDK.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { createRouter, retry } from '../src/index.js';
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

// Example 2: Using retry for resilient AI generation
async function example2() {
  const result = await retry(
    () =>
      generateText({
        model,
        prompt: 'Write a detailed essay about renewable energy',
      }),
    { maxRetries: 3 }
  );

  console.log('Example 2 - With retry:');
  console.log(result.text);
}

// Example 3: Advanced retry with custom options
async function example3() {
  const result = await retry(
    () =>
      generateText({
        model,
        prompt: 'Explain machine learning algorithms',
      }),
    {
      maxRetries: 5,
      initialDelay: 500,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) => {
        // Only retry on rate limit or timeout errors
        if (error instanceof Error) {
          return error.message.includes('rate limit') || error.message.includes('timeout');
        }
        return false;
      },
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt} after ${delay}ms`);
      },
    }
  );

  console.log('Example 3 - Advanced retry:');
  console.log(result.text);
}

// Run examples (uncomment to execute)
// example1();
// example2();
// example3();
