import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Global } from '../../src/global';
import { Instance } from '../../src/project/instance';
import { Project } from '../../src/project/project';
import { Snapshot } from '../../src/snapshot';

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function exists(target: string) {
  return fs.stat(target).then(
    () => true,
    () => false
  );
}

async function writeJSON(target: string, value: unknown) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(value));
}

describe('snapshot object storage', () => {
  const data = Global.Path.data;
  let root: string;
  let repository: string;

  beforeEach(async () => {
    await fs.rm(data, { recursive: true, force: true });
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-snapshot-test-'));
    repository = path.join(root, 'repository');
    await fs.mkdir(repository);
    git(repository, 'init', '-q');
    git(repository, 'config', 'user.email', 'test@example.com');
    git(repository, 'config', 'user.name', 'Test');
    await fs.writeFile(path.join(repository, 'tracked.txt'), 'original\n');
    git(repository, 'add', 'tracked.txt');
    git(repository, 'commit', '-qm', 'fixture');
  });

  afterEach(async () => {
    await Instance.disposeAll();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(data, { recursive: true, force: true });
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

    const snapshot = path.join(data, 'snapshot', result.projectID);
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

  test('prunes only old orphan snapshots and their storage records', async () => {
    const now = Date.now();
    const fixtures = [
      { id: 'newest', age: 0, worktree: path.join(root, 'missing-newest') },
      {
        id: 'recent',
        age: 5 * 60_000,
        worktree: path.join(root, 'missing-recent'),
      },
      { id: 'live', age: 60 * 60_000, worktree: repository },
      {
        id: 'orphan',
        age: 60 * 60_000,
        worktree: path.join(root, 'missing-orphan'),
      },
    ];

    for (const fixture of fixtures) {
      const snapshot = path.join(data, 'snapshot', fixture.id);
      await fs.mkdir(snapshot, { recursive: true });
      const modified = new Date(now - fixture.age);
      await fs.utimes(snapshot, modified, modified);
      await writeJSON(
        path.join(data, 'storage', 'project', `${fixture.id}.json`),
        {
          id: fixture.id,
          worktree: fixture.worktree,
          vcs: 'git',
          time: { created: now - fixture.age },
        }
      );
    }

    await writeJSON(
      path.join(data, 'storage', 'session', 'orphan', 'session-1.json'),
      { id: 'session-1', projectID: 'orphan' }
    );
    await writeJSON(
      path.join(data, 'storage', 'message', 'session-1', 'message-1.json'),
      { id: 'message-1', sessionID: 'session-1' }
    );
    await writeJSON(
      path.join(data, 'storage', 'part', 'message-1', 'part-1.json'),
      { id: 'part-1', messageID: 'message-1' }
    );
    await writeJSON(
      path.join(data, 'storage', 'session_diff', 'session-1.json'),
      []
    );
    await writeJSON(path.join(data, 'storage', 'todo', 'session-1.json'), [
      { content: 'left behind', status: 'pending', priority: 'high' },
    ]);

    const prune = (Project as typeof Project & { prune?: () => Promise<void> })
      .prune;
    expect(prune).toBeFunction();
    if (!prune) return;
    await prune();

    for (const id of ['newest', 'recent', 'live']) {
      expect(await exists(path.join(data, 'snapshot', id))).toBe(true);
      expect(
        await exists(path.join(data, 'storage', 'project', `${id}.json`))
      ).toBe(true);
    }
    expect(await exists(path.join(data, 'snapshot', 'orphan'))).toBe(false);
    expect(
      await exists(path.join(data, 'storage', 'project', 'orphan.json'))
    ).toBe(false);
    expect(
      await exists(
        path.join(data, 'storage', 'session', 'orphan', 'session-1.json')
      )
    ).toBe(false);
    expect(
      await exists(
        path.join(data, 'storage', 'message', 'session-1', 'message-1.json')
      )
    ).toBe(false);
    expect(
      await exists(
        path.join(data, 'storage', 'part', 'message-1', 'part-1.json')
      )
    ).toBe(false);
    expect(
      await exists(path.join(data, 'storage', 'session_diff', 'session-1.json'))
    ).toBe(false);
    expect(
      await exists(path.join(data, 'storage', 'todo', 'session-1.json'))
    ).toBe(false);
  });

  test('prunes orphan snapshots when a project starts', async () => {
    const orphan = path.join(data, 'snapshot', 'startup-orphan');
    await fs.mkdir(orphan, { recursive: true });
    const old = Date.now() - 60 * 60_000;
    await fs.utimes(orphan, new Date(old), new Date(old));
    await writeJSON(
      path.join(data, 'storage', 'project', 'startup-orphan.json'),
      {
        id: 'startup-orphan',
        worktree: path.join(root, 'missing-startup'),
        vcs: 'git',
        time: { created: old },
      }
    );
    await fs.mkdir(path.join(data, 'snapshot', 'startup-newest'));

    await Project.fromDirectory(repository);

    expect(await exists(orphan)).toBe(false);
  });

  test('prunes orphan snapshots when an instance is disposed', async () => {
    await Instance.provide({
      directory: repository,
      fn: async () => {
        const orphan = path.join(data, 'snapshot', 'dispose-orphan');
        await fs.mkdir(orphan, { recursive: true });
        const old = Date.now() - 60 * 60_000;
        await fs.utimes(orphan, new Date(old), new Date(old));
        await writeJSON(
          path.join(data, 'storage', 'project', 'dispose-orphan.json'),
          {
            id: 'dispose-orphan',
            worktree: path.join(root, 'missing-dispose'),
            vcs: 'git',
            time: { created: old },
          }
        );
        await fs.mkdir(path.join(data, 'snapshot', 'dispose-newest'));

        await Instance.dispose();
        expect(await exists(orphan)).toBe(false);
      },
    });
  });
});
