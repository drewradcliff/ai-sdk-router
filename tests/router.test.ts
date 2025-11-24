import { describe, it, expect, vi } from 'vitest';
import { createRouter } from '../src/router.js';
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
