# ai-router

Minimal, type-safe, AI router.

## Features

- **Flexible** - Works with any AI SDK provider
- **Retry utilities** - Built-in exponential backoff retry for resilient AI generations

## Installation

```bash
pnpm add ai-router
```

You'll also need model providers if not already installed:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic
```

## Quick Start

```ts
import { createRouter } from 'ai-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Create router with tier-based model selection
const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },

  // Define your routing logic
  select: (request) => {
    if (request.prompt?.length > 1000) return 'deep';
    if (request.messages?.length > 10) return 'smart';
    return 'fast';
  },
});

// Use with AI SDK
const prompt = 'Explain quantum computing';
const model = router.selectModel({ prompt });

const result = await generateText({
  model,
  prompt,
});
```

## Utilities

### Retry

The library includes retry utility with exponential backoff:

#### Basic Retry

```ts
import { retry } from 'ai-router';

const model = router.selectModel({ prompt });
const result = await retry(() => generateText({ model, prompt }), { maxRetries: 3 });
```

#### Advanced Retry Options

```ts
const result = await retry(() => generateText({ model, prompt }), {
  maxRetries: 5,
  initialDelay: 500, // Start with 500ms delay
  maxDelay: 10000, // Cap at 10 seconds
  backoffMultiplier: 2, // Double delay each retry

  // Only retry specific errors
  shouldRetry: (error) => {
    if (error instanceof Error) {
      return error.message.includes('rate limit') || error.message.includes('timeout');
    }
    return false;
  },

  // Log retry attempts
  onRetry: (error, attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms:`, error);
  },

  // Handle max retries exceeded
  onMaxRetriesExceeded: (error, attempts) => {
    console.error(`Failed after ${attempts} attempts`);
  },
});
```
