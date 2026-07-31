/**
 * Regression tests for the CI/CD helper scripts in ../../scripts.
 *
 * These cover the two production CI failures fixed in issue #287:
 *   1. Rust "Auto Release" exited with code 3 because the crate name was read
 *      with a plain grep that also matched [lib]/[[bin]]/[[test]] sections.
 *   2. The npm publish job reported "Failed to publish after 3 attempts" even
 *      though attempt 1 had published successfully — verification ran before
 *      the registry had propagated, and the miss triggered a republish that
 *      then hit EPUBLISHCONFLICT.
 */

import { describe, expect, test } from 'bun:test';

import {
  formatNpmPackageVersion,
  parsePackageInfo,
} from '../../scripts/package-info.mjs';
import {
  buildPackageMetadataUrl,
  encodePackageName,
  isPackageVersionPublished,
  normalizeRegistryUrl,
} from '../../scripts/npm-registry.mjs';
import { isNonRetryableFailure } from '../../scripts/publish-failure-classifier.mjs';
import {
  isAlreadyPublishedError,
  publishWithRetry,
  waitForVersionOnRegistry,
} from '../../scripts/publish-retry.mjs';
import {
  parseCrateInfo,
  readPackageKey,
} from '../../scripts/rust-package-info.mjs';

const noSleep = () => Promise.resolve();
const noLog = () => {};

// A Cargo.toml shaped like rust/Cargo.toml: many sections carry `name = "..."`.
const CARGO_TOML = `[package]
name = "link-assistant-agent"
version = "0.9.2"
edition = "2021"

[lib]
name = "agent_lib"
path = "src/lib.rs"

[[bin]]
name = "agent"
path = "src/main.rs"

[[test]]
name = "cli_options"
path = "tests/cli_options.rs"

[[test]]
name = "version"
path = "tests/version.rs"
`;

describe('rust-package-info', () => {
  test('reads name and version from the [package] section only', () => {
    expect(parseCrateInfo(CARGO_TOML)).toEqual({
      name: 'link-assistant-agent',
      version: '0.9.2',
    });
  });

  test('does not leak names from [lib]/[[bin]]/[[test]] sections', () => {
    const name = readPackageKey(CARGO_TOML, 'name');
    expect(name).toBe('link-assistant-agent');
    expect(name).not.toContain('\n');
    expect(name).not.toContain('agent_lib');
  });

  test('ignores keys defined before any section header', () => {
    expect(
      readPackageKey('name = "stray"\n[package]\nname = "real"\n', 'name')
    ).toBe('real');
  });

  test('throws when the package name or version is missing', () => {
    expect(() => parseCrateInfo('[package]\nversion = "1.0.0"\n')).toThrow(
      /name/
    );
    expect(() => parseCrateInfo('[package]\nname = "x"\n')).toThrow(/version/);
  });
});

describe('package-info', () => {
  test('parses name and version', () => {
    expect(parsePackageInfo('{"name":"@scope/pkg","version":"1.2.3"}')).toEqual(
      {
        name: '@scope/pkg',
        version: '1.2.3',
      }
    );
  });

  test('reports the file path on invalid JSON', () => {
    expect(() => parsePackageInfo('{', 'js/package.json')).toThrow(
      /js\/package.json/
    );
  });

  test('formats a package@version specifier', () => {
    expect(formatNpmPackageVersion('@scope/pkg', '1.2.3')).toBe(
      '@scope/pkg@1.2.3'
    );
  });
});

describe('npm-registry', () => {
  test('percent-encodes the slash in scoped package names', () => {
    expect(encodePackageName('@link-assistant/agent')).toBe(
      '@link-assistant%2Fagent'
    );
    expect(encodePackageName('agent')).toBe('agent');
  });

  test('strips trailing slashes from the registry URL', () => {
    expect(normalizeRegistryUrl('https://registry.npmjs.org/')).toBe(
      'https://registry.npmjs.org'
    );
  });

  test('builds the metadata URL', () => {
    expect(
      buildPackageMetadataUrl(
        '@link-assistant/agent',
        'https://registry.npmjs.org/'
      )
    ).toBe('https://registry.npmjs.org/@link-assistant%2Fagent');
  });

  test('returns true only when the exact version exists', async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ versions: { '1.0.0': {} } }),
    });

    expect(await isPackageVersionPublished('pkg', '1.0.0', { fetchFn })).toBe(
      true
    );
    expect(await isPackageVersionPublished('pkg', '1.0.1', { fetchFn })).toBe(
      false
    );
  });

  test('treats a 404 as not published', async () => {
    const fetchFn = async () => ({ ok: false, status: 404 });
    expect(await isPackageVersionPublished('pkg', '1.0.0', { fetchFn })).toBe(
      false
    );
  });
});

describe('publish failure classification', () => {
  test('recognises already-published conflicts', () => {
    expect(isAlreadyPublishedError('npm error code EPUBLISHCONFLICT')).toBe(
      true
    );
    expect(
      isAlreadyPublishedError(
        'You cannot publish over the previously published versions: 0.25.4.'
      )
    ).toBe(true);
    expect(isAlreadyPublishedError('npm error 401 Unauthorized')).toBe(false);
  });

  test('marks auth/registry errors as non-retryable', () => {
    expect(isNonRetryableFailure('npm error code ENEEDAUTH')).toBe(true);
    expect(isNonRetryableFailure('socket hang up')).toBe(false);
  });
});

describe('waitForVersionOnRegistry', () => {
  test('polls until the version appears', async () => {
    let calls = 0;
    const verify = async () => ++calls >= 3;

    expect(
      await waitForVersionOnRegistry({ verify, sleepFn: noSleep, log: noLog })
    ).toBe(true);
    expect(calls).toBe(3);
  });

  test('gives up after the configured number of attempts', async () => {
    let calls = 0;
    const verify = async () => {
      calls++;
      return false;
    };

    expect(
      await waitForVersionOnRegistry({
        verify,
        attempts: 4,
        sleepFn: noSleep,
        log: noLog,
      })
    ).toBe(false);
    expect(calls).toBe(4);
  });
});

describe('publishWithRetry', () => {
  test('does not republish when verification lags behind a successful publish', async () => {
    let publishes = 0;
    let verifies = 0;

    const { success } = await publishWithRetry({
      publish: async () => {
        publishes++;
        return { success: true, output: 'packages published successfully' };
      },
      // First verification misses (registry propagation lag), second succeeds.
      verify: async () => ++verifies >= 2,
      sleepFn: noSleep,
      log: noLog,
    });

    expect(success).toBe(true);
    expect(publishes).toBe(1);
  });

  test('treats an already-published conflict as a cue to verify, not to fail', async () => {
    let publishes = 0;

    const { success } = await publishWithRetry({
      publish: async () => {
        publishes++;
        return {
          success: false,
          error: new Error('EPUBLISHCONFLICT'),
          output: 'You cannot publish over the previously published versions',
        };
      },
      verify: async () => true,
      sleepFn: noSleep,
      log: noLog,
    });

    expect(success).toBe(true);
    expect(publishes).toBe(1);
  });

  test('retries a genuine publish failure and succeeds', async () => {
    let publishes = 0;

    const { success } = await publishWithRetry({
      publish: async () => {
        publishes++;
        if (publishes < 2) {
          return {
            success: false,
            error: new Error('socket hang up'),
            output: '',
          };
        }
        return { success: true, output: '' };
      },
      verify: async () => true,
      maxRetries: 3,
      sleepFn: noSleep,
      log: noLog,
    });

    expect(success).toBe(true);
    expect(publishes).toBe(2);
  });

  test('fails fast on a non-retryable error', async () => {
    let publishes = 0;

    const { success, error } = await publishWithRetry({
      publish: async () => {
        publishes++;
        const failure = new Error('npm error code ENEEDAUTH');
        failure.nonRetryable = true;
        return {
          success: false,
          error: failure,
          output: 'npm error code ENEEDAUTH',
        };
      },
      verify: async () => false,
      maxRetries: 3,
      sleepFn: noSleep,
      log: noLog,
    });

    expect(success).toBe(false);
    expect(publishes).toBe(1);
    expect(error.nonRetryable).toBe(true);
  });

  test('reports a terminal verification failure without republishing', async () => {
    let publishes = 0;

    const { success, error } = await publishWithRetry({
      publish: async () => {
        publishes++;
        return { success: true, output: '' };
      },
      verify: async () => false,
      maxRetries: 3,
      sleepFn: noSleep,
      log: noLog,
    });

    expect(success).toBe(false);
    expect(publishes).toBe(1);
    expect(error.verificationFailed).toBe(true);
    expect(error.nonRetryable).toBe(true);
  });
});
