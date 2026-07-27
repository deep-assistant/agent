import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

const originalWarn = console.warn;

afterEach(() => {
  console.warn = originalWarn;
});

function successfulChatCompletion() {
  const chunks = [
    {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'test-model',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'ok' },
          finish_reason: null,
        },
      ],
    },
    {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'test-model',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    },
  ];
  const body =
    chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
    'data: [DONE]\n\n';

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('AI SDK warning-free multi-turn requests', () => {
  test('OpenAI-compatible requests do not emit warnings', async () => {
    const warnings: unknown[][] = [];
    console.warn = mock((...args: unknown[]) => warnings.push(args));

    const provider = createOpenAICompatible({
      name: 'test-provider',
      baseURL: 'https://example.invalid/v1',
      apiKey: 'test-key',
      fetch: async () => successfulChatCompletion(),
    });
    const model = provider('test-model');

    for (let turn = 0; turn < 2; turn++) {
      const result = streamText({
        model,
        system: 'You are a test assistant.',
        messages: [{ role: 'user', content: `Turn ${turn + 1}` }],
      });
      expect(await result.text).toBe('ok');
    }

    expect(warnings).toEqual([]);
  });
});
