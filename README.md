# ai-router

Intelligent model routing for ai-sdk.

## Features

- Route requests to different models based on prompt length, complexity, or any custom logic
- Thin wrapper around AI SDK

## Installation

```bash
pnpm add ai-router ai
```

You'll also need model providers:

```bash
pnpm add @ai-sdk/openai @ai-sdk/anthropic
```

## Quick Start

```ts
import { createRouter } from 'ai-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const model = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    if (request.prompt.length > 1000) {
      return 'deep';
    }
    return 'fast';
  },
});

const result = await generateText({
  model,
  prompt: 'Explain quantum computing',
});
```

## Utilities

### Retry with Exponential Backoff

#### Basic Retry

```ts
import { retry } from 'ai-router';

const result = await retry(() => generateText({ model, prompt: '...' }), { maxRetries: 3 });
```

#### Advanced Retry Options

```ts
const result = await retry(() => generateText({ model, prompt: '...' }), {
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
