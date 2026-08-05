import { test, expect, describe, mock } from 'bun:test';
import { APICallError } from 'ai';
import { MessageV2 } from '../src/session/message-v2.ts';
import { RetryFetch } from '../src/provider/retry-fetch.ts';
import { isUnreachableNetworkError } from '../src/util/network-error.ts';

/**
 * A refused connection or an unresolvable host is not a transient upstream
 * condition — retrying it for the global 7-day retry budget (#167) makes the
 * CLI hang forever instead of failing fast.
 *
 * @see https://github.com/link-assistant/agent/issues/290
 */

describe('isUnreachableNetworkError (#290)', () => {
  test('detects ConnectionRefused in the error cause', () => {
    const error = new Error('Unable to connect', {
      cause: { code: 'ConnectionRefused', path: 'http://127.0.0.1:8080' },
    });
    expect(isUnreachableNetworkError(error)).toBe(true);
  });

  test('detects ECONNREFUSED in the error message', () => {
    expect(isUnreachableNetworkError(new Error('connect ECONNREFUSED'))).toBe(
      true
    );
  });

  test('detects ENOTFOUND (host does not resolve)', () => {
    expect(
      isUnreachableNetworkError(
        new Error('getaddrinfo ENOTFOUND api.example.invalid')
      )
    ).toBe(true);
  });

  test('does not flag transient socket errors', () => {
    expect(
      isUnreachableNetworkError(
        new Error('The socket connection was closed unexpectedly')
      )
    ).toBe(false);
    expect(isUnreachableNetworkError(new Error('ECONNRESET'))).toBe(false);
    // Transient DNS failures stay retryable.
    expect(isUnreachableNetworkError(new Error('EAI_AGAIN'))).toBe(false);
  });
});

describe('MessageV2.fromError with a refused connection (#290)', () => {
  test('marks an AI SDK APICallError caused by ConnectionRefused as non-retryable', () => {
    const error = new APICallError({
      message: 'Unable to connect. Is the computer able to access the url?',
      url: 'http://127.0.0.1:8080/api/openai/v1/chat/completions',
      requestBodyValues: {},
      isRetryable: true,
      cause: { code: 'ConnectionRefused', errno: 0 },
    });

    const result = MessageV2.fromError(error, { providerID: 'formal-ai' });

    expect(result.name).toBe('APIError');
    expect(result.data.isRetryable).toBe(false);
  });

  test('keeps genuinely transient API errors retryable', () => {
    const error = new APICallError({
      message: 'Too many requests',
      url: 'https://api.example.com/v1/chat/completions',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });

    const result = MessageV2.fromError(error, { providerID: 'formal-ai' });

    expect(result.name).toBe('APIError');
    expect(result.data.isRetryable).toBe(true);
  });
});

describe('RetryFetch with a refused connection (#290)', () => {
  test('rethrows ECONNREFUSED immediately instead of retrying', async () => {
    const mockFetch = mock(() =>
      Promise.reject(
        new Error('connect ECONNREFUSED 127.0.0.1:8080', {
          cause: { code: 'ConnectionRefused' },
        })
      )
    );

    const retryFetch = RetryFetch.create({
      baseFetch: mockFetch as unknown as typeof fetch,
    });

    await expect(retryFetch('http://127.0.0.1:8080')).rejects.toThrow(
      'ECONNREFUSED'
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
