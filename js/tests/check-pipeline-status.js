import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests for scripts/check-pipeline-status.sh.
 *
 * The false negative it prevents: GitHub reports a job killed by
 * `timeout-minutes` as cancelled rather than failed. Every gate of this
 * pipeline is written as `needs.<job>.result == 'success'`, so a cancelled
 * check skips the release instead of failing the run, and the pipeline stays
 * green while nothing was released.
 * See https://github.com/link-assistant/agent/issues/301.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(repoRoot, 'scripts', 'check-pipeline-status.sh');

function run(needs, { isMain = false } = {}) {
  const env = { ...process.env, IS_MAIN: String(isMain) };
  if (needs !== undefined) {
    env.NEEDS_JSON = JSON.stringify(needs);
  } else {
    delete env.NEEDS_JSON;
  }
  const result = spawnSync('bash', [script], { encoding: 'utf8', env });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

describe('check-pipeline-status.sh', () => {
  test('passes when every job succeeded or was skipped', () => {
    const { status, output } = run({
      lint: { result: 'success' },
      test: { result: 'success' },
      release: { result: 'skipped' },
    });

    expect(status).toBe(0);
    expect(output).toContain('All required jobs succeeded');
  });

  test('fails and names the failing jobs', () => {
    const { status, output } = run({
      lint: { result: 'failure' },
      test: { result: 'success' },
      build: { result: 'failure' },
    });

    expect(status).toBe(1);
    expect(output).toContain('::error::Pipeline failed');
    expect(output).toContain('lint, build');
  });

  // The case this script exists for: `timeout-minutes` kills a job on main.
  test('fails on a cancelled job on main', () => {
    const { status, output } = run(
      { test: { result: 'cancelled' }, lint: { result: 'success' } },
      { isMain: true }
    );

    expect(status).toBe(1);
    expect(output).toContain('cancelled jobs on main');
  });

  // Off main a cancellation is normally `cancel-in-progress` replacing a
  // superseded run, which must not turn the pull request red.
  test('only warns about a cancelled job outside main', () => {
    const { status, output } = run({ test: { result: 'cancelled' } });

    expect(status).toBe(0);
    expect(output).toContain('::warning::Cancelled jobs: test');
  });

  test('refuses to run without NEEDS_JSON', () => {
    const { status, output } = run(undefined);

    expect(status).not.toBe(0);
    expect(output).toContain('NEEDS_JSON is required');
  });
});
