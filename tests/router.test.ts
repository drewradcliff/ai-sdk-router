import { describe, it, expect } from 'vitest';
import { createRouter } from '../src/router.js';
import type { LanguageModel } from 'ai';

// Mock language models for testing
const mockFastModel = { modelId: 'fast-model' } as LanguageModel;
const mockSmartModel = { modelId: 'smart-model' } as LanguageModel;
const mockDeepModel = { modelId: 'deep-model' } as LanguageModel;

describe('createRouter', () => {
  it('should create a router with valid configuration', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: () => 'fast',
    });

    expect(router).toBeDefined();
    expect(router.selectModel).toBeDefined();
    expect(router.getModel).toBeDefined();
    expect(router.getRoutes).toBeDefined();
  });

  it('should throw error when models are empty', () => {
    expect(() =>
      createRouter({
        models: {} as Record<string, LanguageModel>,
        select: () => 'fast',
      })
    ).toThrow('Router configuration must include at least one model');
  });

  it('should throw error when select function is missing', () => {
    expect(() =>
      createRouter({
        models: { fast: mockFastModel },
        select: undefined as any,
      })
    ).toThrow('Router configuration must include a select function');
  });
});

describe('AIRouter.selectModel', () => {
  it('should select model based on prompt length', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
        deep: mockDeepModel,
      },
      select: (request) => {
        if (request.prompt.length > 1000) return 'deep';
        if (request.prompt.length > 100) return 'smart';
        return 'fast';
      },
    });

    const shortPrompt = { prompt: 'Hi' };
    const mediumPrompt = { prompt: 'a'.repeat(150) };
    const longPrompt = { prompt: 'a'.repeat(1500) };

    expect(router.selectModel(shortPrompt)).toBe(mockFastModel);
    expect(router.selectModel(mediumPrompt)).toBe(mockSmartModel);
    expect(router.selectModel(longPrompt)).toBe(mockDeepModel);
  });

  it('should select model based on message count', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: (request) => {
        if (request.messages.length > 10) return 'smart';
        return 'fast';
      },
    });

    const fewMessages = {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ],
    };

    const manyMessages = {
      messages: Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })),
    };

    expect(router.selectModel(fewMessages)).toBe(mockFastModel);
    expect(router.selectModel(manyMessages)).toBe(mockSmartModel);
  });

  it('should handle empty request object', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: () => 'fast',
    });

    expect(router.selectModel({})).toBe(mockFastModel);
  });

  it('should handle custom request properties', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: (request) => {
        if (request.complexity === 'high') return 'smart';
        return 'fast';
      },
    });

    expect(router.selectModel({ complexity: 'low' })).toBe(mockFastModel);
    expect(router.selectModel({ complexity: 'high' })).toBe(mockSmartModel);
  });

  it('should throw error when select returns invalid route', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
      },
      select: () => 'nonexistent' as any,
    });

    expect(() => router.selectModel({})).toThrow(
      'Selected route "nonexistent" does not exist in models'
    );
  });
});

describe('AIRouter.getModel', () => {
  it('should return model for valid route', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: () => 'fast',
    });

    expect(router.getModel('fast')).toBe(mockFastModel);
    expect(router.getModel('smart')).toBe(mockSmartModel);
  });

  it('should return undefined for invalid route', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
      },
      select: () => 'fast',
    });

    expect(router.getModel('nonexistent' as any)).toBeUndefined();
  });
});

describe('AIRouter.getRoutes', () => {
  it('should return all route names', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
        deep: mockDeepModel,
      },
      select: () => 'fast',
    });

    const routes = router.getRoutes();
    expect(routes).toHaveLength(3);
    expect(routes).toContain('fast');
    expect(routes).toContain('smart');
    expect(routes).toContain('deep');
  });

  it('should return routes in correct order', () => {
    const router = createRouter({
      models: {
        a: mockFastModel,
        b: mockSmartModel,
        c: mockDeepModel,
      },
      select: () => 'a',
    });

    const routes = router.getRoutes();
    expect(routes).toEqual(['a', 'b', 'c']);
  });
});

describe('Type safety', () => {
  it('should infer route types from models object', () => {
    const router = createRouter({
      models: {
        fast: mockFastModel,
        smart: mockSmartModel,
      },
      select: () => 'fast',
    });

    // These should work at compile time
    const model1 = router.getModel('fast');
    const model2 = router.getModel('smart');

    expect(model1).toBeDefined();
    expect(model2).toBeDefined();
  });
});
