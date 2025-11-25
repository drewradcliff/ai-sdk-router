import { createRouter } from 'ai-sdk-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModelV1 } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

// Create a router with fallback chain and custom retry logic
const model = createRouter({
  models: {
    fast: [openai('gpt-4o-mini'), openai('gpt-4o')],
    deep: [anthropic('claude-4-sonnet-20250514'), openai('gpt-4o')],
  },
  select: (request: { prompt?: string }) => {
    // Route longer prompts to Claude (deep thinking)
    if (request.prompt && request.prompt.length > 100) {
      return 'deep';
    }
    // Route shorter prompts to GPT-4o Mini (fast)
    return 'fast';
  },
  retry: {
    maxRetries: 3,
    initialDelay: 1000, // Start with 1 second
    maxDelay: 10000, // Cap at 10 seconds
    backoffMultiplier: 2, // Exponential backoff
    shouldRetry: (error: unknown) => {
      // Only retry on rate limit or timeout errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
          message.includes('rate limit') ||
          message.includes('timeout') ||
          message.includes('503') ||
          message.includes('502')
        );
      }
      return false;
    },
    onRetry: (error: unknown, attempt: number, delay: number) => {
      console.log(`🔄 Retry attempt ${attempt} after ${delay}ms delay`);
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
    onFallback: (error: unknown, fromModel: LanguageModelV1, toModel: LanguageModelV1) => {
      console.log(`⚡ Falling back from ${fromModel.modelId} to ${toModel.modelId}`);
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
    onMaxRetriesExceeded: (error: unknown, attempts: number) => {
      console.error(`❌ Failed after ${attempts} retry attempts`);
    },
  },
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    logs.push(`📝 Starting request with ${prompt.length} character prompt`);

    // Generate text using the router with automatic retry and fallback
    const result = await generateText({
      model,
      prompt,
    });

    const duration = Date.now() - startTime;
    const selectedModel =
      prompt.length > 100 ? 'Claude 4 Sonnet (with fallback)' : 'GPT-4o Mini (with fallback)';

    logs.push(`✅ Successfully generated response in ${duration}ms`);

    return NextResponse.json({
      text: result.text,
      model: selectedModel,
      promptLength: prompt.length,
      duration,
      logs,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    logs.push(`❌ Request failed after ${duration}ms: ${errorMessage}`);

    console.error('Error generating text:', error);
    return NextResponse.json(
      {
        error: errorMessage,
        duration,
        logs,
      },
      { status: 500 }
    );
  }
}
