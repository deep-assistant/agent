import { describe, test, expect } from 'bun:test';

import {
  hasUnmaskedApiKey,
  inspectVerboseHttpLog,
  readLoggedStatus,
} from './lib/verbose-http-log.js';

/**
 * Unit tests for the verbose HTTP log contract used by
 * tests/integration/verbose-hi.js, which is a release gate in js.yml.
 *
 * The regression they lock in: the integration test asserted `"status": 200`,
 * so a provider-side rate limit (429) or outage (503) reported this repository
 * as broken and blocked the release, even though verbose logging worked
 * perfectly. See https://github.com/link-assistant/agent/issues/287.
 */

function buildLog(status) {
  return [
    '[verbose] HTTP logging active',
    JSON.stringify({
      message: 'HTTP request',
      method: 'POST',
      url: 'https://api.example.com/v1/chat',
      headers: { authorization: 'sk-a...5678' },
      bodyPreview: '{"messages":[{"role":"user","content":"hi"}]}',
    }),
    JSON.stringify({ message: 'HTTP response', status, durationMs: 412 }),
    JSON.stringify({ message: 'HTTP response body (stream)', status }),
  ].join('\n');
}

describe('readLoggedStatus', () => {
  test('reads the status from spaced and compact JSON', () => {
    expect(readLoggedStatus('"status": 200')).toBe(200);
    expect(readLoggedStatus('"status":429')).toBe(429);
  });

  test('returns null when no status was logged', () => {
    expect(readLoggedStatus('nothing here')).toBe(null);
  });
});

describe('hasUnmaskedApiKey', () => {
  test('accepts masked and redacted values', () => {
    expect(hasUnmaskedApiKey('"authorization": "sk-a...5678"')).toBe(false);
    expect(hasUnmaskedApiKey('"x-api-key": "[REDACTED]"')).toBe(false);
  });

  test('flags a full key', () => {
    expect(
      hasUnmaskedApiKey('"authorization": "sk-abcdefghijklmnopqrstuvwxyz"')
    ).toBe(true);
  });

  test('accepts a log without any sensitive header', () => {
    expect(hasUnmaskedApiKey('"content-type": "application/json"')).toBe(false);
  });
});

describe('inspectVerboseHttpLog', () => {
  test('passes every check for a successful exchange', () => {
    const result = inspectVerboseHttpLog(buildLog(200));

    expect(result.failures).toEqual([]);
    expect(result.status).toBe(200);
  });

  test('still passes when the provider rate limits the request', () => {
    // The regression this file exists for: a 429 must not fail the gate.
    const result = inspectVerboseHttpLog(buildLog(429));

    expect(result.failures).toEqual([]);
    expect(result.status).toBe(429);
  });

  test('reports which parts of the logging contract are missing', () => {
    const result = inspectVerboseHttpLog('completely silent run');

    expect(result.status).toBe(null);
    expect(result.failures).toContain('HTTP request logged');
    expect(result.failures).toContain('HTTP response logged');
    expect(result.checks['sensitive headers masked']).toBe(true);
  });
});
