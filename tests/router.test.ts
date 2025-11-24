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
        // @ts-expect-error - testing invalid config
        select: undefined,
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
      // @ts-expect-error - testing invalid route
      select: () => 'nonexistent',
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

    try {
      await model.doGenerate(options);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        'Selected route "nonexistent" does not exist in models'
      );
    }
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

describe('Router retry functionality', () => {
  it('should retry failed doGenerate calls', async () => {
    let callCount = 0;
    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('rate limit exceeded');
        }
        return {
          text: 'Success after retries',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    const result = await router.doGenerate(options);
    expect(result.text).toBe('Success after retries');
    expect(mockModel.doGenerate).toHaveBeenCalledTimes(3);
  });

  it('should retry failed doStream calls', async () => {
    let callCount = 0;
    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(),
      doStream: vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('timeout error');
        }
        return {
          stream: new ReadableStream(),
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 3,
        initialDelay: 10,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    const result = await router.doStream(options);
    expect(result).toBeDefined();
    expect(mockModel.doStream).toHaveBeenCalledTimes(2);
  });

  it('should respect shouldRetry callback', async () => {
    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        throw new Error('auth error');
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        shouldRetry: (error) => {
          // Don't retry auth errors
          if (error instanceof Error && error.message.includes('auth')) {
            return false;
          }
          return true;
        },
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    await expect(router.doGenerate(options)).rejects.toThrow('auth error');
    // Should only be called once since we don't retry auth errors
    expect(mockModel.doGenerate).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    let callCount = 0;
    const onRetrySpy = vi.fn();
    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('rate limit');
        }
        return {
          text: 'Success',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        onRetry: onRetrySpy,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    await router.doGenerate(options);

    // Should be called twice (for attempt 1 and 2, before the successful attempt 3)
    expect(onRetrySpy).toHaveBeenCalledTimes(2);

    // Verify the callback was called with correct parameters
    expect(onRetrySpy).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
  });

  it('should call onMaxRetriesExceeded callback', async () => {
    const onMaxRetriesSpy = vi.fn();
    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        throw new Error('persistent error');
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 2,
        initialDelay: 10,
        onMaxRetriesExceeded: onMaxRetriesSpy,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    await expect(router.doGenerate(options)).rejects.toThrow('persistent error');

    // Should be called once when retries are exhausted
    expect(onMaxRetriesSpy).toHaveBeenCalledTimes(1);
    expect(onMaxRetriesSpy).toHaveBeenCalledWith(
      expect.any(Error),
      3 // total attempts (initial + 2 retries)
    );
  });

  it('should use per-model retry configuration', async () => {
    let fastCalls = 0;
    let deepCalls = 0;

    const fastModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'fast',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        fastCalls++;
        if (fastCalls < 2) {
          throw new Error('error');
        }
        return {
          text: 'Fast success',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const deepModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'deep',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        deepCalls++;
        if (deepCalls < 4) {
          throw new Error('error');
        }
        return {
          text: 'Deep success',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { fast: fastModel, deep: deepModel },
      select: (request) => {
        if (request.prompt && request.prompt.length > 50) return 'deep';
        return 'fast';
      },
      retry: {
        fast: { maxRetries: 2, initialDelay: 10 },
        deep: { maxRetries: 5, initialDelay: 10 },
        default: { maxRetries: 1 },
      },
    });

    // Fast model with short prompt
    const shortOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    const fastResult = await router.doGenerate(shortOptions);
    expect(fastResult.text).toBe('Fast success');
    expect(fastModel.doGenerate).toHaveBeenCalledTimes(2);

    // Deep model with long prompt
    const longOptions: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'a'.repeat(100) }] }],
    };

    const deepResult = await router.doGenerate(longOptions);
    expect(deepResult.text).toBe('Deep success');
    expect(deepModel.doGenerate).toHaveBeenCalledTimes(4);
  });

  it('should work without retry configuration', async () => {
    const mockModel = createMockModel('test');

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      // No retry configuration
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    const result = await router.doGenerate(options);
    expect(result).toBeDefined();
    expect(mockModel.doGenerate).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    let callCount = 0;
    const callTimes: number[] = [];

    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        callCount++;
        callTimes.push(Date.now());
        if (callCount < 4) {
          throw new Error('retry');
        }
        return {
          text: 'Success',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 5,
        initialDelay: 100,
        backoffMultiplier: 2,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    await router.doGenerate(options);

    // Verify exponential backoff timing
    // First retry: ~100ms, second: ~200ms, third: ~400ms
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(95);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(195);
    expect(callTimes[3] - callTimes[2]).toBeGreaterThanOrEqual(395);
  });

  it('should respect maxDelay', async () => {
    let callCount = 0;
    const callTimes: number[] = [];

    const mockModel: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'test',
      defaultObjectGenerationMode: 'json',
      doGenerate: vi.fn(async () => {
        callCount++;
        callTimes.push(Date.now());
        if (callCount < 4) {
          throw new Error('retry');
        }
        return {
          text: 'Success',
          finishReason: 'stop' as const,
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: {}, rawSettings: {} },
        };
      }),
      doStream: vi.fn(),
    } as LanguageModelV1;

    const router = createRouter({
      models: { test: mockModel },
      select: () => 'test',
      retry: {
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 150, // Cap at 150ms
        backoffMultiplier: 2,
      },
    });

    const options: LanguageModelV1CallOptions = {
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
    };

    await router.doGenerate(options);

    // Second retry would be 200ms but should be capped at 150ms
    expect(callTimes[2] - callTimes[1]).toBeLessThan(200);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(145);
  });
});
