import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests for scripts/simulate-fresh-merge.sh.
 *
 * The false negative it prevents: GitHub builds `refs/pull/N/merge` when the
 * pull request is synchronized, so commits landing on main afterwards are not
 * part of what CI checked. A pull request could be green while the merged
 * result was broken. See https://github.com/link-assistant/agent/issues/287.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(repoRoot, 'scripts', 'simulate-fresh-merge.sh');

let workspace;

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function commit(cwd, file, contents, message) {
  writeFileSync(join(cwd, file), contents);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-m', message);
}

function runScript(cwd) {
  return execFileSync('bash', [script], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, BASE_REF: 'main' },
  });
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'fresh-merge-'));

  // `origin` is a real repository on disk so `git fetch origin main` works.
  const origin = join(workspace, 'origin');
  execFileSync('git', ['init', '-q', '-b', 'main', origin]);
  git(origin, 'config', 'user.email', 'test@example.com');
  git(origin, 'config', 'user.name', 'Test');
  commit(origin, 'base.txt', 'one\n', 'base');

  const clone = join(workspace, 'clone');
  execFileSync('git', ['clone', '-q', origin, clone]);
  git(clone, 'config', 'user.email', 'test@example.com');
  git(clone, 'config', 'user.name', 'Test');
  git(clone, 'checkout', '-q', '-b', 'feature');
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('simulate-fresh-merge.sh', () => {
  test('does nothing when the checkout already contains the base branch', () => {
    const clone = join(workspace, 'clone');

    const output = runScript(clone);

    expect(output).toContain('no merge needed');
    expect(git(clone, 'log', '--oneline')).not.toContain('Merge');
  });

  test('merges commits that landed on the base branch after the checkout', () => {
    const origin = join(workspace, 'origin');
    const clone = join(workspace, 'clone');
    commit(clone, 'feature.txt', 'feature\n', 'feature work');
    commit(origin, 'later.txt', 'later\n', 'later base commit');

    const output = runScript(clone);

    expect(output).toContain('Fresh merge simulation succeeded');
    // The check that runs after this script now sees both changes.
    expect(git(clone, 'ls-files')).toContain('later.txt');
    expect(git(clone, 'ls-files')).toContain('feature.txt');
  });

  test('fails with an actionable error on a merge conflict', () => {
    const origin = join(workspace, 'origin');
    const clone = join(workspace, 'clone');
    commit(clone, 'base.txt', 'feature version\n', 'feature edit');
    commit(origin, 'base.txt', 'base version\n', 'base edit');

    let error;
    try {
      runScript(clone);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(`${error.stdout}${error.stderr}`).toContain(
      '::error::Merge conflict with main'
    );
  });

  test('refuses to run without BASE_REF', () => {
    let error;
    try {
      execFileSync('bash', [script], {
        cwd: join(workspace, 'clone'),
        encoding: 'utf8',
        env: { ...process.env, BASE_REF: '' },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeDefined();
    expect(`${error.stdout}${error.stderr}`).toContain('BASE_REF is not set');
  });
});
