/**
 * Classification of network-level errors that are *not* transient.
 *
 * A refused connection or an unresolvable host will not start working as a
 * side effect of retrying: nothing is listening on the port, or the name does
 * not resolve. Retrying those for the global retry budget (7 days by default,
 * see #167) makes the CLI hang forever instead of failing fast.
 *
 * Transient DNS failures (EAI_AGAIN) are deliberately NOT included — those can
 * recover on their own and stay retryable.
 *
 * @see https://github.com/link-assistant/agent/issues/290
 */

/** Error codes/markers that mean "the endpoint is unreachable, permanently". */
const UNREACHABLE_MARKERS = [
  'ConnectionRefused',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_NONAME',
  'ERR_NAME_NOT_RESOLVED',
  'failed to lookup address information',
  'Unable to connect. Is the computer able to access the url?',
];

function collectStrings(value: unknown, depth: number, out: string[]): void {
  if (depth > 5 || value === null || value === undefined) return;

  if (typeof value === 'string') {
    out.push(value);
    return;
  }

  if (typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  for (const key of ['code', 'errno', 'name', 'message', 'syscall']) {
    const field = record[key];
    if (typeof field === 'string') out.push(field);
  }
  collectStrings(record['cause'], depth + 1, out);
  collectStrings(record['error'], depth + 1, out);
  collectStrings(record['data'], depth + 1, out);
}

/**
 * Returns true when the error means the endpoint cannot be reached at all
 * (connection refused, host not found) and retrying cannot help.
 */
export function isUnreachableNetworkError(error: unknown): boolean {
  const haystack: string[] = [];
  collectStrings(error, 0, haystack);
  const joined = haystack.join('\n');
  if (!joined) return false;
  return UNREACHABLE_MARKERS.some((marker) => joined.includes(marker));
}
