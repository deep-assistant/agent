import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regression test for the retry wait timer.
 *
 * `sleep()` in src/provider/retry-fetch.ts used to unref its timer. While a
 * rate limit wait is in flight that timer is the only pending work, so the
 * runtime was free to stop waiting on it: the retry was dropped instead of
 * performed. On Bun for Windows the process stopped making progress entirely
 * and the unit test job burned its whole 20 minute timeout.
 *
 * This runs the wait in a fresh process — the failure mode only exists when
 * nothing else keeps the event loop alive, which is never true inside the
 * shared test runner. Bun on Linux happens to keep servicing an unref'd timer,
 * so this test only turns red on a runtime that does not; it is here to catch
 * that difference on every platform the matrix covers.
 *
 * @see https://github.com/link-assistant/agent/issues/287
 */

const jsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const program = `
import { RetryFetch } from './src/provider/retry-fetch';
import { config } from './src/config/config';

config.retryTimeout = 3600;
config.minRetryInterval = 0;

let calls = 0;
const baseFetch = () => {
  calls++;
  return Promise.resolve(
    calls === 1
      ? new Response('rate limited', { status: 429 })
      : new Response('ok', { status: 200 })
  );
};

const response = await RetryFetch.create({ baseFetch })('https://example.com');
console.log(JSON.stringify({ calls, status: response.status }));
`;

test('a rate limit wait is not dropped when nothing else keeps the loop alive', () => {
  const result = spawnSync('bun', ['-e', program], {
    cwd: jsRoot,
    encoding: 'utf8',
    timeout: 60_000,
  });

  expect(result.error).toBeUndefined();
  expect([result.status, result.stderr]).toEqual([0, result.stderr]);
  expect(JSON.parse(result.stdout.trim().split('\n').at(-1))).toEqual({
    calls: 2,
    status: 200,
  });
}, 60_000);
