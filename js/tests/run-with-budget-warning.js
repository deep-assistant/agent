import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = join(repoRoot, 'scripts', 'run-with-budget-warning.sh');
// The script is bash-only; the Windows matrix leg has no usable process
// groups, so the fixtures below are skipped there rather than reported as
// failures.
const canRunShellFixtures = process.platform !== 'win32';

function runBudget(args, env = {}) {
  const result = spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });

  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

describe('run-with-budget-warning.sh', () => {
  test('passes a successful command through with its output and exit code', () => {
    if (!canRunShellFixtures) {
      return;
    }

    const result = runBudget([
      '30',
      'quick step',
      'bash',
      '-c',
      'echo from-command',
    ]);

    expect(result.status).toBe(0);
    expect(result.output).toContain('from-command');
    expect(result.output).toContain('quick step finished in');
  });

  test('preserves the exit code of a failing command', () => {
    if (!canRunShellFixtures) {
      return;
    }

    const result = runBudget(['30', 'failing step', 'bash', '-c', 'exit 3']);

    expect(result.status).toBe(3);
    expect(result.output).not.toContain('::error');
  });

  test('fails with exit code 124 and a titled error when the budget expires', () => {
    if (!canRunShellFixtures) {
      return;
    }

    const result = runBudget(['2', 'slow suite', 'sleep', '60'], {
      BUDGET_GRACE_SECONDS: '2',
    });

    expect(result.status).toBe(124);
    expect(result.output).toContain(
      '::error title=slow suite exceeded its execution budget::'
    );
    expect(result.output).toContain('2s budget');
  });

  test('warns while the overrun can still be acted on', () => {
    if (!canRunShellFixtures) {
      return;
    }

    const result = runBudget(['3', 'warned step', 'sleep', '2'], {
      BUDGET_WARN_PERCENT: '30',
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      '::warning title=warned step is approaching its execution budget::'
    );
  });

  test('kills workers spawned by the command, not just the direct child', () => {
    if (!canRunShellFixtures) {
      return;
    }

    // A unique sleep duration doubles as a marker pgrep can match on.
    const workerSeconds = 900000 + (process.pid % 1000);
    const result = runBudget(
      [
        '2',
        'suite with workers',
        'bash',
        '-c',
        `sleep ${workerSeconds} & sleep ${workerSeconds}`,
      ],
      { BUDGET_GRACE_SECONDS: '1' }
    );

    expect(result.status).toBe(124);

    const survivors = spawnSync('pgrep', ['-f', `^sleep ${workerSeconds}$`], {
      encoding: 'utf8',
    });

    expect(survivors.stdout.trim()).toBe('');
  });

  test('rejects a missing or non-numeric budget', () => {
    if (!canRunShellFixtures) {
      return;
    }

    expect(runBudget(['30', 'no command']).status).toBe(2);
    expect(runBudget(['ten', 'bad budget', 'true']).status).toBe(2);
    expect(runBudget(['0', 'zero budget', 'true']).status).toBe(2);
  });
});
