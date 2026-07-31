import { test, expect, setDefaultTimeout } from 'bun:test';
// @ts-ignore
import { sh } from 'command-stream';

import { inspectVerboseHttpLog } from '../lib/verbose-http-log.js';

// Increase default timeout to 120 seconds — real API calls may take longer
setDefaultTimeout(120000);

/**
 * Integration test: verifies that --verbose mode produces HTTP request/response logs.
 *
 * This is the hero test for issue #221. It sends the simplest possible message ("hi")
 * to a real API and verifies that HTTP traffic is fully logged in verbose mode.
 *
 * This test uses a real API with free-tier limits. It is the ONLY real-API test
 * intended for CI/CD execution. Other integration tests are manual (workflow_dispatch).
 *
 * What is asserted is the logging contract only. The HTTP status the provider
 * returned is reported but not asserted: this test gates the release in js.yml,
 * and asserting `status == 200` turned a provider rate limit into a red build.
 * The parsing rules live in tests/lib/verbose-http-log.js and are unit tested
 * in tests/verbose-http-log.js.
 *
 * @see https://github.com/link-assistant/agent/issues/221
 * @see https://github.com/link-assistant/agent/issues/287
 */

test('Agent-cli --verbose mode logs HTTP requests and responses for "hi"', async () => {
  const projectRoot = process.cwd();
  const input = '{"message":"hi"}';

  // Run with --verbose and --no-retry-on-rate-limits to get verbose HTTP logs
  const result = await sh(
    `echo '${input}' | bun run ${projectRoot}/src/index.js --verbose --no-retry-on-rate-limits`,
    { timeout: 110000 }
  );

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const combined = `${stdout}\n${stderr}`;

  console.log('\n=== Verbose test: stdout length:', stdout.length);
  console.log('=== Verbose test: stderr length:', stderr.length);

  // The agent must have produced output at all.
  expect(stdout.length).toBeGreaterThan(0);

  const { checks, failures, status } = inspectVerboseHttpLog(combined);

  for (const [name, passed] of Object.entries(checks)) {
    console.log(`   - ${name}: ${passed ? '✓' : '✗'}`);
  }
  console.log(`   - provider HTTP status: ${status ?? 'none logged'}`);

  if (status !== null && status !== 200) {
    // Informational: the provider is having a bad day, the logging still works.
    console.log(
      `⚠ Provider responded with ${status}; verbose logging is still verified.`
    );
  }

  expect(failures).toEqual([]);

  // Informational: the model may be temporarily unavailable, which does not
  // affect what this test verifies.
  const hasStepStart =
    combined.includes('"type": "step_start"') ||
    combined.includes('"type":"step_start"') ||
    combined.includes('"type": "step-start"') ||
    combined.includes('"type":"step-start"');
  console.log(
    `   - agent step events: ${hasStepStart ? '✓' : '⚠ (model may be temporarily unavailable)'}`
  );
});
