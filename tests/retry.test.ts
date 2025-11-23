/**
 * Tests for retry utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retry, MaxRetriesExceededError } from '../src/utils/retry.js';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retry(fn, { maxRetries: 3 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = retry(fn, { maxRetries: 3 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw MaxRetriesExceededError after max retries', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    const resultPromise = retry(fn, { maxRetries: 2 });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow(MaxRetriesExceededError);
    await expect(resultPromise).rejects.toThrow('Max retries (3) exceeded');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should apply exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = retry(fn, {
      maxRetries: 2,
      initialDelay: 1000,
      backoffMultiplier: 2,
    });

    // First call fails
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for first retry (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait for second retry (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('should respect maxDelay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = retry(fn, {
      maxRetries: 2,
      initialDelay: 1000,
      backoffMultiplier: 10,
      maxDelay: 5000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // First retry should use 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry should be capped at maxDelay (5000ms), not 10000ms
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('should call onRetry callback', async () => {
    const error1 = new Error('fail 1');
    const error2 = new Error('fail 2');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const resultPromise = retry(fn, {
      maxRetries: 2,
      initialDelay: 1000,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, error1, 1, 1000);
    expect(onRetry).toHaveBeenNthCalledWith(2, error2, 2, 2000);
  });

  it('should call onMaxRetriesExceeded callback', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);
    const onMaxRetriesExceeded = vi.fn();

    const resultPromise = retry(fn, {
      maxRetries: 1,
      onMaxRetriesExceeded,
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow(MaxRetriesExceededError);
    expect(onMaxRetriesExceeded).toHaveBeenCalledOnce();
    expect(onMaxRetriesExceeded).toHaveBeenCalledWith(error, 2);
  });

  it('should respect shouldRetry function', async () => {
    const retryableError = new Error('rate limit exceeded');
    const nonRetryableError = new Error('invalid request');

    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(nonRetryableError);

    const shouldRetry = vi.fn((error: unknown) => {
      if (error instanceof Error) {
        return error.message.includes('rate limit');
      }
      return false;
    });

    const resultPromise = retry(fn, {
      maxRetries: 3,
      shouldRetry,
    });
    await vi.runAllTimersAsync();

    // Should throw the non-retryable error immediately
    await expect(resultPromise).rejects.toThrow('invalid request');

    // Should have been called twice (first error retried, second error not retried)
    expect(fn).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledTimes(2);
  });

  it('should not retry if shouldRetry returns false on first attempt', async () => {
    const error = new Error('do not retry');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    const resultPromise = retry(fn, {
      maxRetries: 3,
      shouldRetry,
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow('do not retry');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error, 1);
  });
});

describe('MaxRetriesExceededError', () => {
  it('should include error details', () => {
    const originalError = new Error('original');
    const maxRetriesError = new MaxRetriesExceededError(originalError, 3);

    expect(maxRetriesError).toBeInstanceOf(Error);
    expect(maxRetriesError.name).toBe('MaxRetriesExceededError');
    expect(maxRetriesError.message).toContain('Max retries (3) exceeded');
    expect(maxRetriesError.message).toContain('original');
    expect(maxRetriesError.lastError).toBe(originalError);
    expect(maxRetriesError.attempts).toBe(3);
  });

  it('should handle non-Error last error', () => {
    const maxRetriesError = new MaxRetriesExceededError('string error', 2);

    expect(maxRetriesError.message).toContain('string error');
    expect(maxRetriesError.lastError).toBe('string error');
  });
});
