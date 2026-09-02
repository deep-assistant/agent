/**
 * Regression tests for scripts/setup-npm.mjs (issue #301).
 *
 * The Release job used to run a bare `npm install -g npm@latest` with no
 * version assertion afterwards. Two failure modes hid behind that:
 *
 *   1. `@latest` is unpinned. Run 31466957921 moved the runner from npm 11.16.0
 *      to npm 12.0.2 mid-release without anyone deciding to.
 *   2. When the install failed, the job either died outright or continued with
 *      an npm too old for OIDC, so the publish step failed later with an opaque
 *      registry error instead of a clear "npm too old" message.
 */

import { describe, expect, test } from 'bun:test';

import {
  NPM_MIN_VERSION,
  NPM_TARGET_MAJOR,
  compareVersions,
  isSupportedNodeVersion,
  isSupportedNpmVersion,
  parseVersion,
  resolveLatestSupportedNpmRelease,
  selectLatestSupportedNpmRelease,
} from '../../scripts/setup-npm.mjs';

const tarball = (version) => ({
  dist: { tarball: `https://registry.npmjs.org/npm/-/npm-${version}.tgz` },
});

describe('parseVersion', () => {
  test('accepts the `v` prefix Node.js uses in process.version', () => {
    expect(parseVersion('v24.19.0')).toEqual({
      major: 24,
      minor: 19,
      patch: 0,
      prerelease: '',
    });
  });

  test('captures a prerelease tag and ignores build metadata', () => {
    expect(parseVersion('11.6.0-beta.1+build.5').prerelease).toBe('beta.1');
  });

  test('rejects a non-semver string instead of silently comparing it', () => {
    expect(() => parseVersion('latest')).toThrow(/Invalid semantic version/);
  });
});

describe('compareVersions', () => {
  test('orders by major, then minor, then patch', () => {
    expect(compareVersions('12.0.2', '11.16.0')).toBe(1);
    expect(compareVersions('11.16.0', '11.17.0')).toBe(-1);
    expect(compareVersions('11.5.1', '11.5.1')).toBe(0);
  });

  test('sorts a release above its own prereleases', () => {
    expect(compareVersions('11.6.0', '11.6.0-rc.1')).toBe(1);
    expect(compareVersions('11.6.0-rc.1', '11.6.0')).toBe(-1);
  });
});

describe('version gates', () => {
  test('npm must reach the OIDC trusted publishing minimum', () => {
    expect(isSupportedNpmVersion('10.9.7')).toBe(false);
    expect(isSupportedNpmVersion('11.5.0')).toBe(false);
    expect(isSupportedNpmVersion(NPM_MIN_VERSION)).toBe(true);
    expect(isSupportedNpmVersion('11.17.0')).toBe(true);
  });

  test('the Node.js gate rejects runtimes below the supported floor', () => {
    expect(isSupportedNodeVersion('v20.20.2')).toBe(false);
    expect(isSupportedNodeVersion('v22.14.0')).toBe(true);
    expect(isSupportedNodeVersion('v24.19.0')).toBe(true);
  });
});

describe('selectLatestSupportedNpmRelease', () => {
  test('stays inside the pinned major instead of jumping to npm 12', () => {
    const selected = selectLatestSupportedNpmRelease({
      versions: {
        '11.16.0': tarball('11.16.0'),
        '11.17.0': tarball('11.17.0'),
        '12.0.2': tarball('12.0.2'),
      },
    });

    expect(parseVersion(selected.version).major).toBe(NPM_TARGET_MAJOR);
    expect(selected.version).toBe('11.17.0');
    expect(selected.tarballUrl).toContain('npm-11.17.0.tgz');
  });

  test('skips prereleases and versions below the OIDC minimum', () => {
    const selected = selectLatestSupportedNpmRelease({
      versions: {
        '11.4.0': tarball('11.4.0'),
        '11.6.0': tarball('11.6.0'),
        '11.9.0-rc.1': tarball('11.9.0-rc.1'),
      },
    });

    expect(selected.version).toBe('11.6.0');
  });

  test('skips a release whose metadata has no tarball', () => {
    const selected = selectLatestSupportedNpmRelease({
      versions: { '11.17.0': {}, '11.16.0': tarball('11.16.0') },
    });

    expect(selected.version).toBe('11.16.0');
  });

  test('throws rather than returning an unusable release', () => {
    expect(() => selectLatestSupportedNpmRelease({ versions: {} })).toThrow(
      /No npm 11.x release/
    );
    expect(() => selectLatestSupportedNpmRelease(undefined)).toThrow(
      /No npm 11.x release/
    );
  });
});

describe('resolveLatestSupportedNpmRelease', () => {
  test('surfaces a registry error instead of falling back silently', async () => {
    const fetchFn = async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(resolveLatestSupportedNpmRelease(fetchFn)).rejects.toThrow(
      /503/
    );
  });

  test('returns the pinned-major release from live metadata', async () => {
    const fetchFn = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        versions: {
          '11.17.0': tarball('11.17.0'),
          '12.0.2': tarball('12.0.2'),
        },
      }),
    });

    expect((await resolveLatestSupportedNpmRelease(fetchFn)).version).toBe(
      '11.17.0'
    );
  });
});
