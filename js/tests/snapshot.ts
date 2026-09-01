import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Global } from '../src/global';
import { Instance } from '../src/project/instance';
import { Snapshot } from '../src/snapshot';

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

describe('snapshot object storage', () => {
  const originalDataPath = Global.Path.data;
  let root: string;
  let repository: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-snapshot-test-'));
    repository = path.join(root, 'repository');
    await fs.mkdir(repository);
    git(repository, 'init', '-q');
    git(repository, 'config', 'user.email', 'test@example.com');
    git(repository, 'config', 'user.name', 'Test');
    await fs.writeFile(path.join(repository, 'tracked.txt'), 'original\n');
    git(repository, 'add', 'tracked.txt');
    git(repository, 'commit', '-qm', 'fixture');
    Object.assign(Global.Path, { data: path.join(root, 'data') });
  });

  afterEach(async () => {
    await Instance.disposeAll();
    Object.assign(Global.Path, { data: originalDataPath });
    await fs.rm(root, { recursive: true, force: true });
  });

  test('shares repository objects and keeps snapshots restorable', async () => {
    const result = await Instance.provide({
      directory: repository,
      fn: async () => ({
        hash: await Snapshot.track(),
        projectID: Instance.project.id,
      }),
    });
    expect(result.hash).toBeTruthy();

    const snapshot = path.join(Global.Path.data, 'snapshot', result.projectID);
    const alternate = await fs
      .readFile(path.join(snapshot, 'objects', 'info', 'alternates'), 'utf8')
      .catch(() => '');
    const objects = git(
      repository,
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'objects'
    );
    expect(alternate).toBe(`${objects}\n`);

    git(
      repository,
      '--git-dir',
      snapshot,
      'cat-file',
      '-e',
      `${result.hash}:tracked.txt`
    );
    await fs.writeFile(path.join(repository, 'tracked.txt'), 'changed\n');
    await Instance.provide({
      directory: repository,
      fn: () => Snapshot.restore(result.hash!),
    });
    expect(
      await fs.readFile(path.join(repository, 'tracked.txt'), 'utf8')
    ).toBe('original\n');
  });
});
