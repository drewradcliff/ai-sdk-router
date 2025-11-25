import { createRouter } from 'ai-sdk-router';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

// Simplest form: array of models as fallback chain
// Tries gpt-4o first, falls back to Claude if it fails
const model = createRouter([
  openai('gpt-4o'),
  anthropic('claude-4-sonnet-20250514'),
]);

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Generate text using the router - automatically falls back if primary fails
    const result = await generateText({
      model,
      prompt,
    });

    return NextResponse.json({
      text: result.text,
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

