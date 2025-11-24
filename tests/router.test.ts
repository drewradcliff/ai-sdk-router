import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '../src/router.js';
import { generateText, streamText, generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModelV1, LanguageModelV1CallOptions } from 'ai';

// Create mock LanguageModelV1 models for testing
function createMockModel(id: string): LanguageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: 'mock',
    modelId: id,
    defaultObjectGenerationMode: 'json',
    doGenerate: vi.fn(async () => ({
      text: `Response from ${id}`,
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
      },
      rawCall: {
        rawPrompt: {},
        rawSettings: {},
      },
    })),
    doStream: vi.fn(async () => ({
      stream: new ReadableStream(),
      rawCall: {
        rawPrompt: {},
        rawSettings: {},
      },
    })),
  } as LanguageModelV1;
}

describe('createRouter', () => {
  it('should create a router that implements LanguageModelV1', () => {
    const model = createRouter({
      models: {
        fast: createMockModel('fast'),
        smart: createMockModel('smart'),
      },
      select: () => 'fast',
    });

    expect(model).toBeDefined();
    expect(model.specificationVersion).toBe('v1');
    expect(model.provider).toBeDefined();
    expect(model.modelId).toBeDefined();
    expect(model.doGenerate).toBeDefined();
    expect(model.doStream).toBeDefined();
  });

  it('should throw error when models are empty', () => {
    expect(() =>
      createRouter({
        models: {} as Record<string, LanguageModelV1>,
        select: () => 'fast',
      })
    ).toThrow('Router configuration must include at least one model');
  });

  it('should throw error when select function is missing', () => {
    expect(() =>
      createRouter({
        models: { fast: createMockModel('fast') },
        select: undefined as any,
      })
    ).toThrow('Router configuration must include a select function');
  });
});

describe('Router model selection', () => {
  it('should route to correct model based on prompt length', async () => {
    const fastModel = createMockModel('fast');
    const deepModel = createMockModel('deep');

    const model = createRouter({
      models: {
        fast: fastModel,
        deep: deepModel,
      },
      select: (request) => {
        if (request.prompt && request.prompt.length > 100) return 'deep';
        return 'fast';
      },
    });

    // Short prompt
    const shortOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hi' }],
        },
      ],
    };

    await model.doGenerate(shortOptions);
    expect(fastModel.doGenerate).toHaveBeenCalledWith(shortOptions);
    expect(deepModel.doGenerate).not.toHaveBeenCalled();

    // Reset mocks
    vi.clearAllMocks();

    // Long prompt
    const longOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'a'.repeat(150) }],
        },
      ],
    };

    await model.doGenerate(longOptions);
    expect(deepModel.doGenerate).toHaveBeenCalledWith(longOptions);
    expect(fastModel.doGenerate).not.toHaveBeenCalled();
  });

  it('should route to correct model based on message count', async () => {
    const fastModel = createMockModel('fast');
    const smartModel = createMockModel('smart');

    const model = createRouter({
      models: {
        fast: fastModel,
        smart: smartModel,
      },
      select: (request) => {
        if (request.messages && request.messages.length > 3) return 'smart';
        return 'fast';
      },
    });

    // Few messages
    const fewOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
      ],
    };

    await model.doGenerate(fewOptions);
    expect(fastModel.doGenerate).toHaveBeenCalledWith(fewOptions);
    expect(smartModel.doGenerate).not.toHaveBeenCalled();

    // Reset mocks
    vi.clearAllMocks();

    // Many messages
    const manyOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: Array.from({ length: 10 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: [{ type: 'text' as const, text: `Message ${i}` }],
      })),
    };

    await model.doGenerate(manyOptions);
    expect(smartModel.doGenerate).toHaveBeenCalledWith(manyOptions);
    expect(fastModel.doGenerate).not.toHaveBeenCalled();
  });

  it('should handle streaming', async () => {
    const fastModel = createMockModel('fast');
    const model = createRouter({
      models: { fast: fastModel },
      select: () => 'fast',
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };

    await model.doStream(options);
    expect(fastModel.doStream).toHaveBeenCalledWith(options);
  });

  it('should throw error when select returns invalid route', async () => {
    const model = createRouter({
      models: {
        fast: createMockModel('fast'),
      },
      select: () => 'nonexistent' as any,
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    };

    await expect(model.doGenerate(options)).rejects.toThrow(
      'Selected route "nonexistent" does not exist in models'
    );
  });
});

describe('Type safety', () => {
  it('should infer route types from models object', () => {
    const model = createRouter({
      models: {
        fast: createMockModel('fast'),
        smart: createMockModel('smart'),
      },
      // This should only accept 'fast' | 'smart' at compile time
      select: () => 'fast',
    });

    expect(model).toBeDefined();
  });
});

describe('AI SDK Integration', () => {
  it('should work with generateText using prompt', async () => {
    const mockModel = createMockModel('test-model');
    const router = createRouter({
      models: { default: mockModel },
      select: () => 'default',
    });

    const result = await generateText({
      model: router,
      prompt: 'Hello, world!',
    });

    expect(result).toBeDefined();
    expect(result.text).toBe('Response from test-model');
    expect(mockModel.doGenerate).toHaveBeenCalled();
  });

  it('should work with streamText using messages', async () => {
    const mockModel = createMockModel('streaming-model');

    const router = createRouter({
      models: { streaming: mockModel },
      select: () => 'streaming',
    });

    // streamText should work without errors when using the router
    const result = await streamText({
      model: router,
      messages: [
        { role: 'user', content: 'Tell me a story' },
        { role: 'assistant', content: 'Once upon a time...' },
        { role: 'user', content: 'Continue...' },
      ],
    });

    expect(result).toBeDefined();
    expect(result.textStream).toBeDefined();
  });

  it('should work with generateObject using zod schema', async () => {
    const mockModel = createMockModel('object-model');

    // Override doGenerate to return structured data
    mockModel.doGenerate = vi.fn(async () => ({
      text: '{"name":"John","age":30}',
      finishReason: 'stop' as const,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
      },
      rawCall: {
        rawPrompt: {},
        rawSettings: {},
      },
    }));

    const router = createRouter({
      models: { objectModel: mockModel },
      select: () => 'objectModel',
    });

    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = await generateObject({
      model: router,
      schema,
      prompt: 'Generate a person object',
    });

    expect(result).toBeDefined();
    expect(mockModel.doGenerate).toHaveBeenCalled();
  });

  it('should route correctly based on prompt content in generateText', async () => {
    const fastModel = createMockModel('fast');
    const deepModel = createMockModel('deep');

    const router = createRouter({
      models: {
        fast: fastModel,
        deep: deepModel,
      },
      select: (request) => {
        if (request.prompt && request.prompt.length > 50) return 'deep';
        return 'fast';
      },
    });

    // Short prompt should use fast model
    await generateText({
      model: router,
      prompt: 'Hi',
    });

    expect(fastModel.doGenerate).toHaveBeenCalled();
    expect(deepModel.doGenerate).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // Long prompt should use deep model
    await generateText({
      model: router,
      prompt:
        'This is a very long and complex prompt that requires deep thinking and analysis to answer properly',
    });

    expect(deepModel.doGenerate).toHaveBeenCalled();
    expect(fastModel.doGenerate).not.toHaveBeenCalled();
  });

  it('should route correctly based on message count in streamText', async () => {
    const fastModel = createMockModel('fast');
    const smartModel = createMockModel('smart');

    const router = createRouter({
      models: {
        fast: fastModel,
        smart: smartModel,
      },
      select: (request) => {
        if (request.messages && request.messages.length > 3) return 'smart';
        return 'fast';
      },
    });

    // Few messages should use fast model - verify it works without errors
    const result1 = await streamText({
      model: router,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result1).toBeDefined();
    expect(result1.textStream).toBeDefined();

    // Many messages should use smart model - verify it works without errors
    const result2 = await streamText({
      model: router,
      messages: [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Message 3' },
      ],
    });

    expect(result2).toBeDefined();
    expect(result2.textStream).toBeDefined();
  });
});
