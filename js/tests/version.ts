import { describe, expect, test } from 'bun:test';
import { VERSION } from '../src/version.ts';
import pkg from '../package.json';

/**
 * Regression test for issue #285: session records used to report a hard-coded
 * `agent-cli-1.0.0` while the process log reported the real version.
 */
describe('version', () => {
  test('matches the package manifest', () => {
    expect(VERSION).toBe(pkg.version);
  });

  test('is a semver-looking string, not a placeholder', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(VERSION).not.toBe('agent-cli-1.0.0');
  });

  test('session records use the shared version', async () => {
    const source = await Bun.file(
      new URL('../src/session/index.ts', import.meta.url)
    ).text();
    expect(source).toContain('version: VERSION,');
    expect(source).not.toContain('agent-cli-1.0.0');
  });
});
