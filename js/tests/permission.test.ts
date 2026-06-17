import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { config, resetConfig } from '../src/config/config';
import { Permission } from '../src/permission/index.ts';
import { Instance } from '../src/project/instance.ts';
import { Bus } from '../src/bus/index.ts';

/**
 * Tests for the native, enforceable permission system (issue #271).
 *
 * Verifies the pure policy machinery (modePolicy / parseOverride / policy /
 * evaluateBash / bashEnforced) and the ask/respond promise lifecycle. The
 * default `auto` mode must be a no-op so existing consumers are unaffected.
 */
describe('permission system (issue #271)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LINK_ASSISTANT_AGENT_')) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    resetConfig();
    // Pure policy resolution reads from the live `config` object. Reset both
    // fields to their auto defaults before each test.
    config.permissionMode = 'auto';
    config.permission = '';
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

  describe('modePolicy', () => {
    test('auto allows everything (default, no behavior change)', () => {
      const p = Permission.modePolicy('auto');
      expect(p.edit).toBe('allow');
      expect(p.webfetch).toBe('allow');
      expect(p.bash['*']).toBe('allow');
    });

    test('plan denies edits, allows read-only shell, asks otherwise', () => {
      const p = Permission.modePolicy('plan');
      expect(p.edit).toBe('deny');
      expect(p.webfetch).toBe('allow');
      expect(p.bash['*']).toBe('ask');
      expect(p.bash['cat*']).toBe('allow');
      expect(p.bash['git diff*']).toBe('allow');
    });

    test('readonly denies edits and non read-only shell, never asks', () => {
      const p = Permission.modePolicy('readonly');
      expect(p.edit).toBe('deny');
      expect(p.webfetch).toBe('allow');
      expect(p.bash['*']).toBe('deny');
      expect(p.bash['ls*']).toBe('allow');
    });

    test('ask asks before every mutating tool', () => {
      const p = Permission.modePolicy('ask');
      expect(p.edit).toBe('ask');
      expect(p.webfetch).toBe('ask');
      expect(p.bash['*']).toBe('ask');
    });
  });

  describe('parseOverride', () => {
    test('empty / whitespace yields no override', () => {
      expect(Permission.parseOverride(undefined)).toEqual({});
      expect(Permission.parseOverride('')).toEqual({});
      expect(Permission.parseOverride('   ')).toEqual({});
    });

    test('parses edit / webfetch / bash map', () => {
      const o = Permission.parseOverride(
        '{"edit":"ask","webfetch":"deny","bash":{"git push*":"ask","*":"allow"}}'
      );
      expect(o.edit).toBe('ask');
      expect(o.webfetch).toBe('deny');
      expect(o.bash).toEqual({ 'git push*': 'ask', '*': 'allow' });
    });

    test('bash as a bare string expands to a catch-all map', () => {
      const o = Permission.parseOverride('{"bash":"ask"}');
      expect(o.bash).toEqual({ '*': 'ask' });
    });

    test('throws on invalid JSON', () => {
      expect(() => Permission.parseOverride('{not json')).toThrow();
    });

    test('throws on invalid action value', () => {
      expect(() => Permission.parseOverride('{"edit":"maybe"}')).toThrow();
    });
  });

  describe('policy() resolution from config', () => {
    test('defaults to full-auto allow-all', () => {
      const p = Permission.policy();
      expect(p.edit).toBe('allow');
      expect(p.bash['*']).toBe('allow');
      expect(Permission.bashEnforced()).toBe(false);
    });

    test('mode + override merge (override wins, bash merged key-by-key)', () => {
      config.permissionMode = 'plan';
      config.permission = '{"bash":{"git push*":"ask"},"webfetch":"deny"}';
      const p = Permission.policy();
      expect(p.edit).toBe('deny'); // from plan base
      expect(p.webfetch).toBe('deny'); // from override
      expect(p.bash['git push*']).toBe('ask'); // merged in
      expect(p.bash['cat*']).toBe('allow'); // base preserved
      expect(Permission.bashEnforced()).toBe(true);
    });

    test('readonly is enforced', () => {
      config.permissionMode = 'readonly';
      expect(Permission.bashEnforced()).toBe(true);
    });
  });

  describe('evaluateBash', () => {
    test('allows a chain of read-only commands in plan mode', () => {
      const patterns = Permission.modePolicy('plan').bash;
      const r = Permission.evaluateBash('cat a.txt && ls -la', patterns);
      expect(r.action).toBe('allow');
    });

    test('most-restrictive wins across a chain (readonly denies)', () => {
      const patterns = Permission.modePolicy('readonly').bash;
      const r = Permission.evaluateBash('cat a.txt && rm -rf /', patterns);
      expect(r.action).toBe('deny');
    });

    test('command substitution falls back to catch-all', () => {
      const patterns = Permission.modePolicy('readonly').bash;
      const r = Permission.evaluateBash('echo $(rm -rf /)', patterns);
      expect(r.action).toBe('deny');
    });

    test('output redirection falls back to catch-all', () => {
      const patterns = Permission.modePolicy('readonly').bash;
      const r = Permission.evaluateBash('cat a.txt > b.txt', patterns);
      expect(r.action).toBe('deny');
    });

    test('plan mode asks for an unknown command and reports a pattern', () => {
      const patterns = Permission.modePolicy('plan').bash;
      const r = Permission.evaluateBash('npm install', patterns);
      expect(r.action).toBe('ask');
      expect(r.askPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('check() enforcement', () => {
    test('allow returns without asking', async () => {
      config.permissionMode = 'auto';
      await Permission.check({
        type: 'edit',
        title: '/tmp/x',
        sessionID: 'ses_test',
        messageID: 'msg_test',
      });
      expect(true).toBe(true);
    });

    test('deny throws RejectedError', async () => {
      config.permissionMode = 'readonly';
      await expect(
        Permission.check({
          type: 'edit',
          title: '/tmp/x',
          sessionID: 'ses_test',
          messageID: 'msg_test',
        })
      ).rejects.toBeInstanceOf(Permission.RejectedError);
    });
  });

  describe('ask / respond lifecycle (JSON-driven approval)', () => {
    test('publishes permission.updated and resolves on "once"', async () => {
      await Instance.provide({
        directory: process.cwd(),
        fn: async () => {
          config.permissionMode = 'ask';
          let requestedID: string | undefined;
          const unsub = Bus.subscribe(Permission.Event.Updated, (e) => {
            requestedID = e.properties.id;
            // Simulate the JSON consumer replying over stdin.
            Permission.respond({
              sessionID: e.properties.sessionID,
              permissionID: e.properties.id,
              response: 'once',
            });
          });
          await Permission.check({
            type: 'edit',
            title: '/tmp/x',
            sessionID: 'ses_ask',
            messageID: 'msg_ask',
          });
          unsub();
          expect(requestedID).toBeDefined();
        },
      });
    });

    test('"reject" rejects the pending ask with RejectedError', async () => {
      await Instance.provide({
        directory: process.cwd(),
        fn: async () => {
          config.permissionMode = 'ask';
          const unsub = Bus.subscribe(Permission.Event.Updated, (e) => {
            Permission.respond({
              sessionID: e.properties.sessionID,
              permissionID: e.properties.id,
              response: 'reject',
            });
          });
          await expect(
            Permission.check({
              type: 'webfetch',
              title: 'https://example.com',
              sessionID: 'ses_rej',
              messageID: 'msg_rej',
            })
          ).rejects.toBeInstanceOf(Permission.RejectedError);
          unsub();
        },
      });
    });

    test('"always" auto-approves later matching asks in the same session', async () => {
      await Instance.provide({
        directory: process.cwd(),
        fn: async () => {
          config.permissionMode = 'ask';
          let asks = 0;
          const unsub = Bus.subscribe(Permission.Event.Updated, (e) => {
            asks++;
            Permission.respond({
              sessionID: e.properties.sessionID,
              permissionID: e.properties.id,
              response: 'always',
            });
          });
          const sessionID = 'ses_always';
          await Permission.check({
            type: 'edit',
            title: '/tmp/a',
            sessionID,
            messageID: 'm1',
          });
          // Second edit in the same session is covered by the "always" grant
          // for the `edit` type and resolves without a new ask.
          await Permission.check({
            type: 'edit',
            title: '/tmp/b',
            sessionID,
            messageID: 'm2',
          });
          unsub();
          expect(asks).toBe(1);
        },
      });
    });
  });
});
