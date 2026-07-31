/**
 * Assertions over the verbose HTTP log produced by `agent --verbose`.
 *
 * Extracted from tests/integration/verbose-hi.js so the parsing rules can be
 * unit tested against recorded logs without calling a real API.
 *
 * The point of the integration test is that verbose mode logs the HTTP
 * exchange. Whether the upstream provider answered 200, 429 or 503 is a
 * property of the provider, not of this repository, so the status code is
 * reported but never asserted to be 200 - doing so turned a provider rate
 * limit into a red CI run that blocked the release.
 * See https://github.com/link-assistant/agent/issues/287.
 */

const REQUEST_MARKERS = [
  '"message": "HTTP request"',
  '"message":"HTTP request"',
];
const RESPONSE_MARKERS = [
  '"message": "HTTP response"',
  '"message":"HTTP response"',
];
const VERBOSE_MARKERS = [
  'verbose HTTP logging active',
  '[verbose] HTTP logging active',
];
const BODY_MARKERS = [
  '"message": "HTTP response body"',
  '"message":"HTTP response body"',
  '"message": "HTTP response body (stream)"',
  '"message":"HTTP response body (stream)"',
];
const METHOD_MARKERS = ['"method": "POST"', '"method":"POST"'];

const API_KEY_PATTERN =
  /["']?(?:x-api-key|authorization|api-key)["']?\s*:\s*["'][a-zA-Z0-9_-]{20,}["']/i;

function includesAny(log, markers) {
  return markers.some((marker) => log.includes(marker));
}

/**
 * Read the HTTP status code out of the verbose log.
 * @param {string} log
 * @returns {number|null} The status, or null when none was logged
 */
export function readLoggedStatus(log) {
  const match = String(log).match(/"status"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

/**
 * Check whether a sensitive header value made it into the log unmasked.
 * @param {string} log
 * @returns {boolean}
 */
export function hasUnmaskedApiKey(log) {
  const match = String(log).match(API_KEY_PATTERN);
  if (!match) {
    return false;
  }
  const value = match[0];
  return !value.includes('...') && !value.includes('[REDACTED]');
}

/**
 * Evaluate the verbose logging contract over a captured log.
 * @param {string} log - Combined stdout and stderr of the agent run
 * @returns {{checks: Record<string, boolean>, failures: string[], status: number|null}}
 */
export function inspectVerboseHttpLog(log) {
  const text = String(log ?? '');

  const checks = {
    'HTTP request logged': includesAny(text, REQUEST_MARKERS),
    'HTTP response logged': includesAny(text, RESPONSE_MARKERS),
    'verbose diagnostic breadcrumb': includesAny(text, VERBOSE_MARKERS),
    'request URL logged': text.includes('https://'),
    'request method logged': includesAny(text, METHOD_MARKERS),
    'response status logged': readLoggedStatus(text) !== null,
    'response body or stream logged': includesAny(text, BODY_MARKERS),
    'headers logged': text.includes('"headers"'),
    'sensitive headers masked': !hasUnmaskedApiKey(text),
    'request body preview logged': text.includes('"bodyPreview"'),
    'request duration logged': text.includes('"durationMs"'),
  };

  return {
    checks,
    failures: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name),
    status: readLoggedStatus(text),
  };
}
