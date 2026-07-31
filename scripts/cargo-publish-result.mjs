/**
 * Classify the outcome of a `cargo publish` invocation.
 *
 * Why this is not a substring scan over the whole output: the previous
 * implementation searched `cargo publish --verbose` output for the substrings
 * `'error: '` and `'error[E'` *before* looking at the exit code, and did so even
 * when cargo had exited 0. Verbose cargo output routinely contains those
 * substrings (dependency build diagnostics, test names, doc examples), so a
 * successful publish could be classified as a failure and retried — the exact
 * false-positive class this repository's release job kept hitting.
 *
 * Unlike `changeset publish`, `cargo publish` reports failure through its exit
 * code reliably, so the exit code is the primary signal and text matching is
 * only used to recognise the "already uploaded" case and to mark
 * authentication errors as non-retryable.
 */

import { isAlreadyPublishedError } from './publish-retry.mjs';

/**
 * Failures that will never be fixed by retrying the same command.
 */
const NON_RETRYABLE_PATTERNS = [
  '401 unauthorized',
  '403 forbidden',
  'no token found',
  'the remote server responded with an error: unauthorized',
  'is not an owner of crate',
  'crate name has already been taken',
];

/**
 * @param {string} output
 * @returns {boolean}
 */
export function isNonRetryableCargoFailure(output) {
  const lowerOutput = String(output || '').toLowerCase();
  return NON_RETRYABLE_PATTERNS.some((pattern) =>
    lowerOutput.includes(pattern)
  );
}

/**
 * Turn a raw cargo publish result into the shape publishWithRetry expects.
 * @param {object} result
 * @param {number} result.code - Process exit code
 * @param {string} [result.stdout]
 * @param {string} [result.stderr]
 * @returns {{success: boolean, error: Error|null, output: string}}
 */
export function classifyCargoPublish({ code, stdout = '', stderr = '' }) {
  const output = `${stdout}\n${stderr}`;

  if (code === 0) {
    return { success: true, error: null, output };
  }

  // A non-zero exit caused by the version already being on the registry is not
  // a failure: the caller only has to verify.
  if (isAlreadyPublishedError(output)) {
    const error = new Error('Crate version is already uploaded');
    return { success: false, error, output };
  }

  const error = new Error(`cargo publish exited with code ${code}`);
  if (isNonRetryableCargoFailure(output)) {
    error.nonRetryable = true;
  }
  return { success: false, error, output };
}
