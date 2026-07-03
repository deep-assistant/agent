import { describe, expect, test } from 'bun:test';

async function resolveFormalAiSelector(selector: string) {
  const script = `
    import { parseModelConfig } from './src/cli/model-config.js';
    import { initConfig, resetConfig } from './src/config/config.ts';
    import { Instance } from './src/project/instance.ts';
    import { Provider } from './src/provider/provider.ts';

    process.argv = ['bun', 'agent', '--model', ${JSON.stringify(selector)}];
    resetConfig();
    initConfig(process.argv);

    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const parsed = await parseModelConfig(
          { model: ${JSON.stringify(selector)}, 'compaction-models': '(same)' },
          () => {},
          () => {},
          { defaultCompactionModels: '(same)' }
        );
        const model = await Provider.getModel(parsed.providerID, parsed.modelID);
        const state = await Provider.state();
        const provider = state.providers[parsed.providerID];

        console.log(
          'RESULT ' +
            JSON.stringify({
              providerID: parsed.providerID,
              modelID: parsed.modelID,
              canonicalModelID: model.info.id,
              providerName: provider.info.name,
              baseURL: provider.options.baseURL,
              apiKey: provider.options.apiKey,
            })
        );
      },
    });

    await Instance.disposeAll();
  `;

  const proc = Bun.spawn({
    cmd: ['bun', '--eval', script],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      FORMAL_AI_API_KEY: 'local-test-token',
      FORMAL_AI_BASE_URL: 'http://127.0.0.1:18080/api/openai/v1',
      LINK_ASSISTANT_AGENT_CONFIG_CONTENT: '{}',
      LINK_ASSISTANT_AGENT_DEFAULT_COMPACTION_MODELS: '(same)',
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      `Formal AI selector ${selector} failed with exit ${exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
    );
  }

  const resultLine = stdout
    .split('\n')
    .find((line) => line.startsWith('RESULT '));
  if (!resultLine) {
    throw new Error(
      `Formal AI selector ${selector} did not print a RESULT line\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
    );
  }

  return JSON.parse(resultLine.slice('RESULT '.length));
}

describe('Formal AI provider defaults', () => {
  test.each([
    ['formal-ai', 'formal-ai'],
    ['formal-ai/formal-ai', 'formal-ai'],
    ['@link-assistant/formal-ai', '@link-assistant'],
    ['formalai/formal-ai', 'formalai'],
  ])(
    'resolves %s without a manual provider config',
    async (selector, expectedProviderID) => {
      const result = await resolveFormalAiSelector(selector);

      expect(result.providerID).toBe(expectedProviderID);
      expect(result.modelID).toBe('formal-ai');
      expect(result.canonicalModelID).toBe('formal-ai');
      expect(result.providerName).toContain('Formal AI');
      expect(result.baseURL).toBe('http://127.0.0.1:18080/api/openai/v1');
      expect(result.apiKey).toBe('local-test-token');
    }
  );
});
