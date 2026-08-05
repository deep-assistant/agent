import { test, expect, describe, setDefaultTimeout } from 'bun:test';
import { spawn } from 'child_process';
import { join } from 'path';

setDefaultTimeout(60000);

/**
 * A fatal startup error (model that cannot be resolved) used to exit 0 and to
 * emit only a `log` record — an automated caller saw a successful, empty run.
 *
 * Root causes:
 * 1. `SessionPrompt.prompt()`'s rejection handler raced with the `session.idle`
 *    event, so the process exited before the handler ran.
 * 2. `hasError` lived in two module scopes (index.js and cli/continuous-mode.js)
 *    and the continuous-mode flag never reached the exit code.
 * 3. The model-resolution failure only logged; it never published
 *    `Session.Event.Error`.
 *
 * @see https://github.com/link-assistant/agent/issues/290
 * @see https://github.com/link-assistant/agent/issues/22
 */

function runAgent(input, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'bun',
      ['run', join(process.cwd(), 'src/index.js'), ...args],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, LINK_ASSISTANT_AGENT_COMPACT_JSON: '1' },
      }
    );

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (exitCode) => resolve({ stdout, stderr, exitCode }));
    proc.on('error', reject);

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

function parseNdjson(text) {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

describe('Fatal startup error (#290)', () => {
  test('exits 1 and emits an error event for an unresolvable model', async () => {
    const { stdout, stderr, exitCode } = await runAgent('say hi\n', [
      '--model',
      'nonexistent-provider/nope',
      '--output-format',
      'json',
    ]);

    expect(exitCode).toBe(1);

    // The error event is emitted on the JSON stream (errors go to stderr, see
    // createEventHandler in src/json-standard/index.ts).
    const events = [...parseNdjson(stdout), ...parseNdjson(stderr)];
    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(JSON.stringify(errorEvent)).toContain('nonexistent-provider');
  });
});
