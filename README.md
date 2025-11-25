# AI Router

Model routing for [AI SDK](https://ai-sdk.dev/). Route requests to different models based on prompt length, complexity, or any custom logic

## Installation

```bash
npm install ai-router
```

Install ai-sdk and providers if you haven't already

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

## Usage

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

## Retry

Configure retry in the router:

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
