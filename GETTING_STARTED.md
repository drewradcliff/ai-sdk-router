# Getting Started with ai-router

## Installation

First, install dependencies:

```bash
pnpm install
```

## Development

### Build the library

```bash
pnpm build
```

This will compile TypeScript to JavaScript and generate type definitions in the `dist/` directory.

### Run tests

```bash
pnpm test
```

Or for watch mode during development:

```bash
pnpm test -- --watch
```

### Type checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

## Project Structure

```
ai-router/
├── src/
│   ├── index.ts         # Main entry point, exports public API
│   ├── router.ts        # Core router implementation
│   └── types.ts         # TypeScript type definitions
├── tests/
│   └── router.test.ts   # Unit tests
├── examples/
│   └── basic-usage.ts   # Usage examples
├── dist/                # Build output (generated)
├── package.json         # Package configuration
├── tsconfig.json        # TypeScript configuration
├── tsup.config.ts       # Build tool configuration
└── vitest.config.ts     # Test configuration
```

## Usage in Your Project

After building, you can use ai-router in your projects:

```typescript
import { createRouter } from 'ai-router';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const router = createRouter({
  models: {
    fast: openai('gpt-3.5-turbo'),
    smart: openai('gpt-4-turbo'),
  },
  select: (request) => {
    if (request.prompt?.length > 500) return 'smart';
    return 'fast';
  }
});

const model = router.selectModel({ prompt: 'Hello!' });
const result = await generateText({ model, prompt: 'Hello!' });
```

## Publishing

When ready to publish to npm:

1. Update version in `package.json`
2. Build the library: `pnpm build`
3. Publish: `pnpm publish`

## Next Steps

- Review the [README.md](./README.md) for detailed API documentation
- Check out [examples/basic-usage.ts](./examples/basic-usage.ts) for usage patterns
- Run tests to ensure everything works: `pnpm test`
- Start building your routing logic!

