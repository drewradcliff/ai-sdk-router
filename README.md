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

## Retry with Exponential Backoff

Configure retry once at the router level - it automatically applies to all requests:

```ts
const model = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    if (request.prompt.length > 1000) return 'deep';
    return 'fast';
  },
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Only retry rate limit and timeout errors
      if (error instanceof Error) {
        return error.message.includes('rate limit') || error.message.includes('timeout');
      }
      return false;
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms`);
    },
  },
});

const result = await generateText({ model, prompt: '...' });
```

### Per-Model Retry Configuration

Different retry policies for different models:

```ts
const model = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    deep: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => (request.prompt.length > 1000 ? 'deep' : 'fast'),
  retry: {
    fast: {
      maxRetries: 2,
      initialDelay: 500,
    },
    deep: {
      maxRetries: 5,
      initialDelay: 2000,
    },
    default: {
      maxRetries: 3,
    },
  },
});
```
