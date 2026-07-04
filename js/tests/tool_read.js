import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Instance } from '../src/project/instance.ts';
import { ReadTool } from '../src/tool/read.ts';

/**
 * JS counterpart of `rust/tests/tool_read.rs`.
 *
 * The Rust port keeps a per-tool unit test for the read tool. The
 * JavaScript implementation tests each tool through its integration
 * suite (see `js/tests/integration/read.tools.js` where the tool
 * is exposed end-to-end).
 *
 * These tests verify the basic shape parity that both implementations
 * agree on: the tool name is a stable lower-case identifier with no
 * whitespace.
 */

const TOOL_NAME = 'read';

const toolContext = {
  sessionID: 'ses_test',
  messageID: 'msg_test',
  agent: 'agent',
  abort: new AbortController().signal,
  metadata() {},
};

async function runReadTool(directory, params) {
  return await Instance.provide({
    directory,
    fn: async () => {
      const tool = await ReadTool.init();
      return await tool.execute(params, toolContext);
    },
  });
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'agent-read-tool-'));
}

afterEach(async () => {
  await Instance.disposeAll();
});

describe('tool read parity with Rust port', () => {
  test('tool name is a stable lower-case identifier', () => {
    expect(TOOL_NAME).toBe(TOOL_NAME.toLowerCase());
    expect(TOOL_NAME).not.toContain(' ');
    expect(TOOL_NAME.length).toBeGreaterThan(0);
  });

  test('summarizes long files with first and last line ranges by default', async () => {
    const directory = makeTempDir();
    const filePath = join(directory, 'long-file.txt');
    const content = Array.from(
      { length: 2105 },
      (_, index) => `line ${index + 1}`
    ).join('\n');
    writeFileSync(filePath, content);

    try {
      const result = await runReadTool(directory, { filePath });

      expect(result.output).toContain('00001| line 1');
      expect(result.output).toContain('02105| line 2105');
      expect(result.output).toContain('... [omitted lines 1001..1105] ...');
      expect(result.output).not.toContain('01050| line 1050');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('summarizes a long single line with omitted column ranges', async () => {
    const directory = makeTempDir();
    const filePath = join(directory, 'long-line.txt');
    writeFileSync(filePath, `START${'m'.repeat(3000)}END`);

    try {
      const result = await runReadTool(directory, { filePath });

      expect(result.output).toContain('00001| START');
      expect(result.output).toContain('END');
      expect(result.output).toContain('[omitted columns 1001..2008 of line 1]');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('supports explicit column windows for selected lines', async () => {
    const directory = makeTempDir();
    const filePath = join(directory, 'columns.txt');
    writeFileSync(filePath, `${'A'.repeat(10)}TARGET${'B'.repeat(10)}`);

    try {
      const result = await runReadTool(directory, {
        filePath,
        columnOffset: 10,
        columnLimit: 6,
      });

      expect(result.output).toContain(
        '00001| [omitted columns 1..10 of line 1] ... TARGET ... [omitted columns 17..26 of line 1]'
      );
      expect(result.output).not.toContain('AAAAATARGET');
      expect(result.output).not.toContain('TARGETBBBBB');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
