# ai-router

Minimal, type-safe model routing for [Vercel AI SDK](https://sdk.vercel.ai/docs). Drop into any project using `ai` SDK and dynamically route requests to different models based on your custom logic.

## Features

- **Zero DSL** - Pure TypeScript, code-only configuration
- **Type-safe** - Full TypeScript support with type inference
- **Minimal** - Single dependency (`ai` as peer dependency)
- **Flexible** - Route based on any request characteristics (prompt length, message count, custom properties)
- **AI SDK Native** - Works seamlessly with `generateText`, `streamText`, and all AI SDK functions

## Installation

```bash
pnpm add ai-router
```

You'll also need the Vercel AI SDK and your model providers:

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic
```

## Quick Start

```typescript
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
  }
});

// Use with AI SDK
const prompt = 'Explain quantum computing';
const model = router.selectModel({ prompt });

const result = await generateText({
  model,
  prompt,
});

console.log(result.text);
```

## API Reference

### `createRouter(config)`

Creates a new AI router instance.

**Parameters:**
- `config: RouterConfig<T>` - Router configuration object
  - `models: Record<T, LanguageModel>` - Map of tier names to language models
  - `select: (request: RouterRequest) => T` - Function to select tier based on request

**Returns:** `AIRouter<T>` - Router instance

### `AIRouter`

Router instance with the following methods:

#### `selectModel(request)`

Select a model based on the request using your configured selection logic.

**Parameters:**
- `request: RouterRequest` - Request information
  - `prompt?: string` - Optional prompt string
  - `messages?: Array<{role: string, content: string}>` - Optional messages array
  - `[key: string]: unknown` - Any custom properties

**Returns:** `LanguageModel` - Selected language model

**Example:**
```typescript
const model = router.selectModel({ 
  prompt: 'Short question',
  complexity: 'low'
});
```

#### `getModel(tier)`

Directly get a model by its tier name.

**Parameters:**
- `tier: T` - Tier name

**Returns:** `LanguageModel | undefined` - Model for that tier

**Example:**
```typescript
const fastModel = router.getModel('fast');
```

#### `getTiers()`

Get all available tier names.

**Returns:** `T[]` - Array of tier names

**Example:**
```typescript
const tiers = router.getTiers(); // ['fast', 'smart', 'deep']
```

## Usage Patterns

### Cost-Based Routing

Route to cheaper models for simple requests:

```typescript
const router = createRouter({
  models: {
    cheap: openai('gpt-3.5-turbo'),
    expensive: openai('gpt-4-turbo'),
  },
  select: (request) => {
    // Use cheaper model for short prompts
    if (request.prompt && request.prompt.length < 200) {
      return 'cheap';
    }
    return 'expensive';
  }
});
```

### Conversation Length Routing

Use smarter models as conversations get longer:

```typescript
const router = createRouter({
  models: {
    basic: openai('gpt-3.5-turbo'),
    advanced: openai('gpt-4-turbo'),
  },
  select: (request) => {
    const messageCount = request.messages?.length ?? 0;
    return messageCount > 5 ? 'advanced' : 'basic';
  }
});
```

### Custom Property Routing

Route based on any custom logic:

```typescript
const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    accurate: anthropic('claude-3-5-sonnet-20241022'),
  },
  select: (request) => {
    // Route based on custom property
    if (request.requiresAccuracy) return 'accurate';
    if (request.needsSpeed) return 'fast';
    return 'fast';
  }
});

// Use with custom properties
const model = router.selectModel({ 
  prompt: 'Analyze this data',
  requiresAccuracy: true 
});
```

### Multi-Provider Routing

Mix and match providers:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: anthropic('claude-3-5-sonnet-20241022'),
    creative: google('gemini-pro'),
  },
  select: (request) => {
    if (request.taskType === 'creative') return 'creative';
    if (request.taskType === 'analytical') return 'smart';
    return 'fast';
  }
});
```

### Streaming with Router

Works seamlessly with `streamText`:

```typescript
import { streamText } from 'ai';

const model = router.selectModel({ prompt: 'Tell me a story' });

const result = streamText({
  model,
  prompt: 'Tell me a story',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## TypeScript Support

Full type safety with automatic type inference:

```typescript
// Tier names are type-checked
const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
  },
  select: (request) => {
    // TypeScript knows valid tiers are 'fast' | 'smart'
    return 'fast'; // ✓ Valid
    // return 'invalid'; // ✗ Type error
  }
});

// Methods are fully typed
const model = router.getModel('fast'); // LanguageModel | undefined
const tiers = router.getTiers(); // ('fast' | 'smart')[]
```

## Why ai-router?

Unlike heavier routing solutions, `ai-router` is:

- **Minimal** - ~100 lines of code, single dependency
- **Transparent** - You control the routing logic, no magic
- **Type-safe** - Full TypeScript support out of the box
- **Drop-in** - Works with existing AI SDK code, no refactoring needed
- **Flexible** - Route on any criteria: cost, speed, accuracy, custom properties

Perfect for production startups that need model routing without the complexity of hosted services or DSLs.

## License

MIT

## Contributing

Contributions welcome! This is a minimal library by design - please open an issue to discuss feature additions before submitting PRs.

