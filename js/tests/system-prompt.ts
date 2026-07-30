import { describe, expect, test, afterEach } from 'bun:test';
import { SystemPrompt } from '../src/session/system.ts';
import { Branding } from '../src/branding.ts';

/**
 * Regression tests for issue #285:
 *
 * 1. an unknown model id must not silently get the without-todo prompt;
 * 2. no rendered system prompt may tell the model it is `opencode`.
 */

const UNKNOWN_MODELS = [
  'formalai/formal-ai',
  'my-org/self-hosted-7b',
  'llama-3.3-70b',
];

afterEach(() => {
  delete process.env['AGENT_SYSTEM_PROMPT'];
});

describe('system prompt selection', () => {
  test('unknown model ids resolve to the default (full) prompt', () => {
    for (const model of UNKNOWN_MODELS) {
      const resolved = SystemPrompt.resolve(model);
      expect(resolved.id).toBe(SystemPrompt.DEFAULT_PROMPT_ID);
      expect(resolved.reason).toContain('default for unknown model');
    }
  });

  test('unknown model ids get a prompt that includes todo instructions', () => {
    for (const model of UNKNOWN_MODELS) {
      const [prompt] = SystemPrompt.provider(model);
      expect(prompt.toLowerCase()).toContain('todo');
    }
  });

  test('known model ids keep their dedicated prompt', () => {
    expect(SystemPrompt.resolve('gpt-5').id).toBe('codex');
    expect(SystemPrompt.resolve('gpt-4o').id).toBe('beast');
    expect(SystemPrompt.resolve('o3-mini').id).toBe('beast');
    expect(SystemPrompt.resolve('gemini-2.5-pro').id).toBe('gemini');
    expect(SystemPrompt.resolve('claude-opus-4').id).toBe('anthropic');
    expect(SystemPrompt.resolve('polaris-alpha').id).toBe('polaris');
    expect(SystemPrompt.resolve('grok-code-fast-1').id).toBe('grok-code');
  });

  test('AGENT_SYSTEM_PROMPT allows an explicit opt-out', () => {
    process.env['AGENT_SYSTEM_PROMPT'] = 'anthropic-without-todo';
    const resolved = SystemPrompt.resolve('formalai/formal-ai');
    expect(resolved.id).toBe('anthropic-without-todo');
    expect(resolved.reason).toContain('override');
  });

  test('an invalid AGENT_SYSTEM_PROMPT value is ignored', () => {
    process.env['AGENT_SYSTEM_PROMPT'] = 'does-not-exist';
    expect(SystemPrompt.resolve('formalai/formal-ai').id).toBe(
      SystemPrompt.DEFAULT_PROMPT_ID
    );
  });
});

describe('product identity in rendered prompts', () => {
  const PROMPT_IDS = [
    'anthropic',
    'anthropic-without-todo',
    'beast',
    'codex',
    'gemini',
    'grok-code',
    'polaris',
  ] as const;

  const FORBIDDEN = [/opencode/i, /sst\/opencode/i, /opencode\.ai/i];

  test('no rendered prompt mentions the upstream product', () => {
    for (const id of PROMPT_IDS) {
      const rendered = SystemPrompt.text(id);
      for (const pattern of FORBIDDEN) {
        expect(rendered).not.toMatch(pattern);
      }
    }
  });

  test('rendered prompts point at this repository for issue reports', () => {
    const rendered = SystemPrompt.text('anthropic-without-todo');
    expect(rendered).toContain(Branding.ISSUES_URL);
  });

  test('summarize and title prompts are branded', () => {
    for (const prompt of [
      ...SystemPrompt.summarize('openai'),
      ...SystemPrompt.title('openai'),
    ]) {
      expect(prompt).not.toMatch(/opencode/i);
    }
  });

  test('branding substitution leaves unrelated text untouched', () => {
    expect(Branding.apply('nothing to replace here')).toBe(
      'nothing to replace here'
    );
    expect(Branding.apply('https://github.com/sst/opencode/issues')).toBe(
      Branding.ISSUES_URL
    );
  });
});
