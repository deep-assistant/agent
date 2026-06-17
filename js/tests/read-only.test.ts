import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { config, initConfig, resetConfig } from '../src/config/config';
import { ToolRegistry } from '../src/tool/registry';

/**
 * Tests for the native, enforceable read-only / planning mode (issue #271).
 *
 * Verifies that `--read-only` and `--disable-tools` are parsed into config and
 * that ToolRegistry.deniedTools() reports the correct set of denied tools.
 */
describe('read-only / planning mode (issue #271)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LINK_ASSISTANT_AGENT_')) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    resetConfig();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LINK_ASSISTANT_AGENT_')) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    resetConfig();
  });

  describe('config defaults', () => {
    test('readOnly defaults to false', () => {
      expect(config.readOnly).toBe(false);
    });

    test('disableTools defaults to empty string', () => {
      expect(config.disableTools).toBe('');
    });

    test('no tools are denied by default', () => {
      expect(ToolRegistry.deniedTools().size).toBe(0);
    });
  });

  describe('--read-only flag', () => {
    test('parses --read-only into config', () => {
      initConfig(['node', 'test', '--read-only']);
      expect(config.readOnly).toBe(true);
    });

    test('denies all mutating tools when read-only', () => {
      initConfig(['node', 'test', '--read-only']);
      const denied = ToolRegistry.deniedTools();
      for (const id of ToolRegistry.READ_ONLY_DENIED_TOOLS) {
        expect(denied.has(id)).toBe(true);
      }
    });

    test('does not deny read-only tools when read-only', () => {
      initConfig(['node', 'test', '--read-only']);
      const denied = ToolRegistry.deniedTools();
      for (const id of ['read', 'list', 'glob', 'grep', 'webfetch']) {
        expect(denied.has(id)).toBe(false);
      }
    });
  });

  describe('LINK_ASSISTANT_AGENT_READ_ONLY env var', () => {
    test('=true enables read-only mode', () => {
      process.env.LINK_ASSISTANT_AGENT_READ_ONLY = 'true';
      resetConfig();
      expect(config.readOnly).toBe(true);
      expect(ToolRegistry.deniedTools().has('bash')).toBe(true);
    });

    test('=1 enables read-only mode', () => {
      process.env.LINK_ASSISTANT_AGENT_READ_ONLY = '1';
      resetConfig();
      expect(config.readOnly).toBe(true);
    });
  });

  describe('--disable-tools flag', () => {
    test('parses a comma-separated list', () => {
      initConfig(['node', 'test', '--disable-tools', 'bash,write']);
      const denied = ToolRegistry.deniedTools();
      expect(denied.has('bash')).toBe(true);
      expect(denied.has('write')).toBe(true);
      expect(denied.has('edit')).toBe(false);
    });

    test('trims whitespace and lowercases ids', () => {
      initConfig(['node', 'test', '--disable-tools', ' Bash , WRITE ']);
      const denied = ToolRegistry.deniedTools();
      expect(denied.has('bash')).toBe(true);
      expect(denied.has('write')).toBe(true);
    });

    test('combines with read-only', () => {
      initConfig([
        'node',
        'test',
        '--read-only',
        '--disable-tools',
        'webfetch',
      ]);
      const denied = ToolRegistry.deniedTools();
      expect(denied.has('webfetch')).toBe(true);
      expect(denied.has('bash')).toBe(true);
    });
  });
});
