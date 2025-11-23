/**
 * Basic usage example for ai-router
 *
 * This example demonstrates how to set up a router with multiple models
 * and use it with the Vercel AI SDK.
 */

import { createRouter } from '../src/index.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Create router with custom routing logic
const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },

  select: (request) => {
    // Route based on prompt length
    if (request.prompt.length > 1000) return 'deep';

    // Route based on message count
    if (request.messages.length > 10) return 'smart';

    // Default to fast model
    return 'fast';
  },
});

// Example 1: Simple prompt-based routing
async function example1() {
  const prompt = 'Explain quantum computing in simple terms';
  const model = router.selectModel({ prompt });

  const result = await generateText({
    model,
    prompt,
  });

  console.log('Example 1 - Short prompt (uses fast model):');
  console.log(result.text);
}

// Example 2: Long prompt routing
async function example2() {
  const longPrompt = 'a'.repeat(1500) + ' Explain this in detail.';
  const model = router.selectModel({ prompt: longPrompt });

  const result = await generateText({
    model,
    prompt: longPrompt,
  });

  console.log('\nExample 2 - Long prompt (uses deep model):');
  console.log(result.text);
}

// Example 3: Direct model access
async function example3() {
  const model = router.getModel('smart');

  if (model) {
    const result = await generateText({
      model,
      prompt: 'What is the capital of France?',
    });

    console.log('\nExample 3 - Direct model access:');
    console.log(result.text);
  }
}

// Example 4: List available tiers
function example4() {
  const tiers = router.getTiers();
  console.log('\nExample 4 - Available tiers:');
  console.log(tiers);
}

// Run examples
async function main() {
  await example1();
  await example2();
  await example3();
  example4();
}

// Uncomment to run:
// main().catch(console.error);
