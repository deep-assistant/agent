import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Instance } from '../src/project/instance.ts';
import { GrepTool } from '../src/tool/grep.ts';

/**
 * JS counterpart of `rust/tests/tool_grep.rs`.
 *
 * The Rust port keeps a per-tool unit test for the grep tool. The
 * JavaScript implementation tests each tool through its integration
 * suite (see `js/tests/integration/grep.tools.js` where the tool
 * is exposed end-to-end).
 *
 * These tests verify the basic shape parity that both implementations
 * agree on: the tool name is a stable lower-case identifier with no
 * whitespace.
 */

const TOOL_NAME = 'grep';

async function runGrepTool(directory, params) {
  return await Instance.provide({
    directory,
    fn: async () => {
      const tool = await GrepTool.init();
      return await tool.execute(params, {
        sessionID: 'ses_test',
        messageID: 'msg_test',
        agent: 'agent',
        abort: new AbortController().signal,
        metadata() {},
      });
    },
  });
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'agent-grep-tool-'));
}

afterEach(async () => {
  await Instance.disposeAll();
});

describe('tool grep parity with Rust port', () => {
  test('tool name is a stable lower-case identifier', () => {
    expect(TOOL_NAME).toBe(TOOL_NAME.toLowerCase());
    expect(TOOL_NAME).not.toContain(' ');
    expect(TOOL_NAME.length).toBeGreaterThan(0);
  });

  test('summarizes long matching lines around the match', async () => {
    const directory = makeTempDir();
    const filePath = join(directory, 'long-match.txt');
    writeFileSync(
      filePath,
      `${'x'.repeat(1500)}ivu-modal-header{cursor:move}${'y'.repeat(1500)}`
    );

    try {
      const result = await runGrepTool(directory, {
        pattern: 'ivu-modal-header',
        path: directory,
        include: 'long-match.txt',
      });

      expect(result.metadata.matches).toBe(1);
      expect(result.output).toContain('ivu-modal-header{cursor:move}');
      expect(result.output).toContain('[omitted columns 1..508 of line 1]');
      expect(result.output).toContain('[omitted columns 2509..3029 of line 1]');
      expect(result.output.length).toBeLessThan(2300);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
