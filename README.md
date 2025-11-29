# AI SDK Router

Model routing for [AI SDK](https://ai-sdk.dev/).

## Installation

```bash
npm install ai-sdk-router
```

Install ai-sdk and providers if you haven't already

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

## Usage

### Simple fallback chain

```ts
import { createRouter } from 'ai-sdk-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Tries gpt-4 first, falls back to claude if it fails
const model = createRouter([
  openai('gpt-4'),
  anthropic('claude-3-5-sonnet-20241022')
]);

const result = await generateText({
  model,
  prompt: 'Explain quantum computing',
});
```

### Fallback chain with custom retry

```ts
const model = createRouter({
  models: [openai('gpt-4'), anthropic('claude-3-5-sonnet-20241022')],
  retry: {
    maxRetries: 5,
    initialDelay: 500,
  },
});
```

### Routing with tiers

```ts
const model = createRouter({
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
});

const result = await generateText({
  model,
  prompt: 'Explain quantum computing',
});
```

### Validate response

Some APIs return `200 OK` with errors in the response body. Use `validateResponse` to detect these and trigger retry/fallback:

```ts
const model = createRouter({
  models: [
    anthropic('claude-sonnet-4-20250514'),
    openai('gpt-4o'), // fallback when Claude is overloaded
  ],
  retry: {
    maxRetries: 3,
    validateResponse: (res) => {
      // Return false to trigger retry/fallback
      return res.response?.type !== 'overloaded_error';
    },
    onInvalidResponse: (response, attempt) => {
      console.log(`Invalid response on attempt ${attempt}:`, response);
    },
  },
});
```
