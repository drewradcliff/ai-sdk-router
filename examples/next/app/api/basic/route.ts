import { createRouter } from 'ai-sdk-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

// Create a router that selects models based on prompt length
const model = createRouter({
  models: {
    fast: openai('gpt-4o-mini'),
    deep: anthropic('claude-4-sonnet-20250514'),
  },
  select: (request: { prompt?: string }) => {
    // Route longer prompts to Claude (deep thinking)
    if (request.prompt && request.prompt.length > 100) {
      return 'deep';
    }
    // Route shorter prompts to GPT-4o Mini (fast)
    return 'fast';
  },
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate text using the router - it will automatically select the right model
    const result = await generateText({
      model,
      prompt,
    });

    // Determine which model was used based on prompt length
    const selectedModel = prompt.length > 100 ? 'Claude 4 Sonnet' : 'GPT-4o Mini';

    return NextResponse.json({
      text: result.text,
      model: selectedModel,
      promptLength: prompt.length,
    });
  } catch (error) {
    console.error('Error generating text:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
