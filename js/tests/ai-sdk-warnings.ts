import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject, generateText, streamText } from 'ai';
import { z } from 'zod';

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

function jsonChatCompletion(content: string) {
  const body = JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'test-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

  return new Response(body, {
    headers: { 'content-type': 'application/json' },
  });
}

function testModel(content = 'ok') {
  return createOpenAICompatible({
    name: 'test-provider',
    baseURL: 'https://example.invalid/v1',
    apiKey: 'test-key',
    fetch: async () => jsonChatCompletion(content),
  })('test-model');
}

async function captureWarnings(run: () => Promise<unknown>) {
  const warnings: string[] = [];
  console.warn = mock((...args: unknown[]) =>
    warnings.push(args.map(String).join(' '))
  );
  await run();
  console.warn = originalWarn;
  return warnings.join('\n');
}

const SYSTEM_IN_MESSAGES_WARNING = 'System messages in the prompt or messages';

// Regression guard for issue #301: every CI run of the summary and agent code
// paths printed "System messages in the prompt or messages fields can be a
// security risk because they may enable prompt injection attacks. Use the
// system option instead when possible." The tests below pin both halves of
// that finding - the old shape warns, and the shape src/session/summary.ts and
// src/agent/agent.ts now use does not.
describe('system prompts are passed through the system option', () => {
  test('system messages inside messages still warn', async () => {
    const warnings = await captureWarnings(() =>
      generateText({
        model: testModel(),
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Summarize this.' },
        ],
      })
    );

    expect(warnings).toContain(SYSTEM_IN_MESSAGES_WARNING);
  });

  test('generateText with the system option is warning-free', async () => {
    const warnings = await captureWarnings(() =>
      generateText({
        model: testModel(),
        system: [
          { role: 'system' as const, content: 'You are a test assistant.' },
        ],
        messages: [{ role: 'user' as const, content: 'Summarize this.' }],
      })
    );

    expect(warnings).toBe('');
  });

  // generateObject against this mock provider also warns about an unsupported
  // "responseFormat" - a provider capability warning, not a prompt shape one -
  // so this test asserts only on the prompt injection warning.
  test('generateObject with the system option does not warn about prompt injection', async () => {
    const warnings = await captureWarnings(() =>
      generateObject({
        model: testModel('{"answer":"ok"}'),
        schema: z.object({ answer: z.string() }),
        system: [
          { role: 'system' as const, content: 'You are a test assistant.' },
        ],
        prompt: [{ role: 'user' as const, content: 'Answer this.' }],
      })
    );

    expect(warnings).not.toContain(SYSTEM_IN_MESSAGES_WARNING);
  });
});
