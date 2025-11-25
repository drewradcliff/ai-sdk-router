'use client';

import { useState } from 'react';

type ResponseData = {
  text: string;
  model: string;
  promptLength: number;
  duration?: number;
  logs?: string[];
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'retry'>('basic');

  const examples = [
    {
      label: 'Short Prompt (→ GPT-4o Mini)',
      text: 'What is TypeScript?',
    },
    {
      label: 'Long Prompt (→ Claude 4 Sonnet)',
      text: 'Explain the concept of type inference in TypeScript, including how the compiler determines types, edge cases to watch out for, and best practices for leveraging it effectively in large codebases.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const endpoint = activeTab === 'basic' ? '/api/basic' : '/api/retry';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate response');
      }

      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-3">
            AI Router Examples
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Intelligent model routing with OpenAI and Anthropic
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl bg-white dark:bg-zinc-900 p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'basic'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            Basic Routing
          </button>
          <button
            onClick={() => setActiveTab('retry')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === 'retry'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            With Retry Logic
          </button>
        </div>

        {/* Info Card */}
        <div className="mb-6 rounded-xl bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-100 dark:border-blue-900">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            {activeTab === 'basic' ? '📍 Basic Routing' : '🔄 Retry Logic'}
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {activeTab === 'basic'
              ? 'Routes prompts based on length: Short prompts (≤100 chars) → GPT-4o Mini, Long prompts (>100 chars) → Claude 4 Sonnet'
              : 'Includes automatic retry with exponential backoff for rate limits and timeouts. Max 3 retries with delays from 1s to 10s.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Enter your prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Type your question or request here..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
              disabled={loading}
              required
            />
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              {prompt.length} characters{' '}
              {prompt.length > 100 ? '(will use Claude 4 Sonnet)' : '(will use GPT-4o Mini)'}
            </div>
          </div>

          {/* Example Prompts */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400 self-center">Try:</span>
            {examples.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(example.text)}
                className="text-xs px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                disabled={loading}
              >
                {example.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-3 font-medium text-white dark:text-zinc-900 shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Response'
            )}
          </button>
        </form>

        {/* Response */}
        {response && (
          <div className="mt-6 rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Response</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    {response.model}
                  </span>
                  {response.duration && <span>{response.duration}ms</span>}
                </div>
              </div>
            </div>
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {response.text}
              </p>
            </div>
            {response.logs && response.logs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Logs</h4>
                <div className="space-y-1">
                  {response.logs.map((log, idx) => (
                    <div key={idx} className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-200 dark:border-red-900">
            <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error</h3>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Powered by{' '}
            <a
              href="https://github.com/drewradcliff/ai-router"
              className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              ai-router
            </a>
            {' • '}
            <a
              href="https://sdk.vercel.ai"
              className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              AI SDK
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
