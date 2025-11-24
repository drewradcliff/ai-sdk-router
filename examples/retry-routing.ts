/**
 * Retry Routing Example
 *
 * This example demonstrates how to configure retry behavior at the router level.
 * Router-level retry automatically handles failures with exponential backoff
 * for all AI SDK functions (generateText, streamText, generateObject, etc.)
 */

import { createRouter } from '../src/index.js';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, streamText } from 'ai';

// Example 1: Global Retry Configuration
// All models use the same retry policy
const modelWithRetry = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    if (request.prompt && request.prompt.length > 1000) {
      return 'deep';
    }
    return 'fast';
  },
  retry: {
    maxRetries: 3,
    initialDelay: 1000, // Start with 1 second
    maxDelay: 10000, // Cap at 10 seconds
    backoffMultiplier: 2, // Double the delay each retry
    shouldRetry: (error, attempt) => {
      // Only retry on rate limit or timeout errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('rate limit') || message.includes('timeout')) {
          console.log(`Will retry (attempt ${attempt}): ${error.message}`);
          return true;
        }
      }
      console.log(`Will not retry: ${error}`);
      return false;
    },
    onRetry: (error, attempt, delay) => {
      console.log(`⏳ Retry attempt ${attempt} after ${delay}ms delay`);
    },
    onMaxRetriesExceeded: (error, attempts) => {
      console.error(`❌ Failed after ${attempts} attempts`);
    },
  },
});

// Example 2: Per-Model Retry Configuration
// Different retry policies for different models
const modelWithPerModelRetry = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
    backup: openai('gpt-4'),
  },
  select: (request) => {
    if (!request.prompt) return 'fast';
    if (request.prompt.length > 2000) return 'deep';
    if (request.prompt.length > 1000) return 'backup';
    return 'fast';
  },
  retry: {
    // Fast model: retry quickly but give up faster
    fast: {
      maxRetries: 2,
      initialDelay: 500,
      maxDelay: 5000,
    },
    // Deep model: more patient retry strategy for expensive model
    deep: {
      maxRetries: 5,
      initialDelay: 2000,
      maxDelay: 30000,
      shouldRetry: (error) => {
        // Always retry for expensive model
        return error instanceof Error;
      },
      onRetry: (error, attempt, delay) => {
        console.log(`🔄 Deep model retry ${attempt} (waiting ${delay}ms)`);
      },
    },
    // Backup model: moderate retry
    backup: {
      maxRetries: 3,
      initialDelay: 1000,
    },
    // Default for any other routes
    default: {
      maxRetries: 3,
    },
  },
});

// Example Usage 1: Basic text generation with automatic retry
async function basicExample() {
  console.log('\n=== Basic Example with Automatic Retry ===');

  try {
    const result = await generateText({
      model: modelWithRetry,
      prompt: 'Explain quantum computing in simple terms',
    });

    console.log('✓ Success:', result.text.substring(0, 100) + '...');
  } catch (error) {
    console.error('Failed:', error);
  }
}

// Example Usage 2: Streaming with automatic retry
async function streamingExample() {
  console.log('\n=== Streaming Example with Automatic Retry ===');

  try {
    const result = streamText({
      model: modelWithRetry,
      prompt: 'Write a haiku about coding',
    });

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n✓ Streaming completed');
  } catch (error) {
    console.error('Failed:', error);
  }
}

// Example Usage 3: Per-model retry in action
async function perModelRetryExample() {
  console.log('\n=== Per-Model Retry Example ===');

  const prompts = [
    { text: 'Hi', expected: 'fast' },
    { text: 'Explain machine learning in 500 words', expected: 'backup' },
    {
      text: 'Write a comprehensive essay on artificial intelligence covering history, current state, future implications, and ethical considerations with detailed examples and citations. This should be at least 2000 words.',
      expected: 'deep',
    },
  ];

  for (const { text, expected } of prompts) {
    console.log(`\nPrompt (${text.length} chars, expects "${expected}" model):`);
    console.log(text.substring(0, 50) + '...');

    try {
      const result = await generateText({
        model: modelWithPerModelRetry,
        prompt: text,
      });

      console.log(`✓ Success with ${expected} model:`, result.text.substring(0, 50) + '...');
    } catch (error) {
      console.error(`Failed:`, error);
    }
  }
}

// Example Usage 4: Comparing with and without retry
async function comparisonExample() {
  console.log('\n=== Comparison: With vs Without Retry ===');

  // Model without retry
  const modelNoRetry = createRouter({
    models: {
      fast: openai('gpt-3.5-turbo'),
    },
    select: () => 'fast',
    // No retry configuration
  });

  const prompt = 'What is the meaning of life?';

  console.log('\nWithout retry (will fail immediately on error):');
  try {
    await generateText({ model: modelNoRetry, prompt });
    console.log('✓ Success');
  } catch (error) {
    console.error('❌ Failed immediately:', error instanceof Error ? error.message : error);
  }

  console.log('\nWith retry (will retry on transient errors):');
  try {
    await generateText({ model: modelWithRetry, prompt });
    console.log('✓ Success (possibly after retries)');
  } catch (error) {
    console.error('❌ Failed after retries:', error instanceof Error ? error.message : error);
  }
}

// Example Usage 5: Custom retry logic for specific use cases
async function customRetryExample() {
  console.log('\n=== Custom Retry Logic Example ===');

  let retryCount = 0;

  const modelCustomRetry = createRouter({
    models: {
      primary: openai('gpt-4'),
      fallback: openai('gpt-3.5-turbo'),
    },
    select: (request) => {
      // Use fallback after 2 failed attempts with primary
      if (retryCount > 2) {
        return 'fallback';
      }
      return 'primary';
    },
    retry: {
      maxRetries: 5,
      shouldRetry: (error, attempt) => {
        // Custom retry logic based on error type
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();

          // Don't retry on authentication errors
          if (msg.includes('unauthorized') || msg.includes('invalid api key')) {
            console.log('Authentication error - not retrying');
            return false;
          }

          // Always retry on rate limits
          if (msg.includes('rate limit')) {
            console.log('Rate limit hit - will retry');
            return true;
          }

          // Retry on 5xx errors up to 3 times
          if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
            console.log('Server error - will retry');
            return attempt <= 3;
          }
        }

        return false;
      },
      onRetry: (error, attempt, delay) => {
        retryCount = attempt;
        console.log(`Retry ${attempt}/${5} after ${delay}ms`);
      },
      onMaxRetriesExceeded: (error, attempts) => {
        console.error(`Giving up after ${attempts} attempts`);
        retryCount = 0; // Reset for next request
      },
    },
  });

  try {
    const result = await generateText({
      model: modelCustomRetry,
      prompt: 'Explain neural networks',
    });
    console.log('✓ Success:', result.text.substring(0, 50) + '...');
  } catch (error) {
    console.error('Failed:', error);
  } finally {
    retryCount = 0; // Reset
  }
}

// Run examples
async function main() {
  console.log('Router-Level Retry Examples\n');
  console.log('These examples demonstrate automatic retry with exponential backoff.');
  console.log('Note: Some examples may fail if API keys are not configured.\n');

  await basicExample();
  await streamingExample();
  await perModelRetryExample();
  await comparisonExample();
  await customRetryExample();

  console.log('\n✨ All examples completed!');
}

// Uncomment to run:
// main().catch(console.error);
