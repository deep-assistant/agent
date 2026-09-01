import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('snapshot storage scenarios pass in an isolated process', () => {
  const xdgRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-snapshot-xdg-'));
  const fixture = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'lib',
    'snapshot.ts'
  );
  try {
    const result = spawnSync(
      process.execPath,
      ['test', '--timeout', '30000', fixture],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          XDG_CACHE_HOME: path.join(xdgRoot, 'cache'),
          XDG_CONFIG_HOME: path.join(xdgRoot, 'config'),
          XDG_DATA_HOME: path.join(xdgRoot, 'data'),
          XDG_STATE_HOME: path.join(xdgRoot, 'state'),
        },
      }
    );
    const output = `${result.stdout}${result.stderr}`;
    if (result.status !== 0) throw new Error(output);
    expect(output).toContain('4 pass');
    expect(output).toContain('0 fail');
  } finally {
    fs.rmSync(xdgRoot, { recursive: true, force: true });
  }
});
