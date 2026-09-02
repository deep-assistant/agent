#!/usr/bin/env node

import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Update npm for OIDC trusted publishing.
 *
 * npm trusted publishing requires npm >= 11.5.1, and the Node.js runtime on the
 * runner does not necessarily ship one.
 *
 * Two production failures shaped this file (issue #301):
 *
 *   1. `npm install -g npm@latest` is unpinned. The last green Release job
 *      silently moved the runner from npm 11.16.0 to npm 12.0.2 — a major
 *      version the publish steps were never tested against. We pin to npm@11.
 *   2. A single install strategy has no recovery path. Node.js 22.22.2 on the
 *      GitHub Actions ubuntu-24.04 image ships a broken npm 10.9.7 that is
 *      missing 'promise-retry', so `npm install -g` dies with MODULE_NOT_FOUND
 *      and the release stops. See:
 *        https://github.com/actions/runner-images/issues/13883
 *        https://github.com/nodejs/node/issues/62430
 *        https://github.com/npm/cli/issues/9151
 *
 * The version helpers below are pure and exported so tests can cover them
 * without fetching dependencies or mutating the global npm installation.
 */

export const NPM_MIN_VERSION = '11.5.1';
export const NODE_MIN_VERSION = '22.14.0';
export const NPM_TARGET_MAJOR = 11;
export const NPM_REGISTRY_METADATA_URL = 'https://registry.npmjs.org/npm';

export function parseVersion(version) {
  const match = String(version)
    .trim()
    .match(
      /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/
    );

  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || '',
  };
}

export function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] > right[key] ? 1 : -1;
    }
  }

  if (left.prerelease === right.prerelease) {
    return 0;
  }

  // A release always sorts above its own prereleases.
  if (!left.prerelease) {
    return 1;
  }

  if (!right.prerelease) {
    return -1;
  }

  return left.prerelease > right.prerelease ? 1 : -1;
}

export function isVersionAtLeast(version, minimumVersion) {
  return compareVersions(version, minimumVersion) >= 0;
}

export function isSupportedNpmVersion(version) {
  return isVersionAtLeast(version, NPM_MIN_VERSION);
}

export function isSupportedNodeVersion(version) {
  return isVersionAtLeast(version, NODE_MIN_VERSION);
}

/**
 * Pick the newest stable npm release inside the pinned major that still
 * supports OIDC trusted publishing.
 */
export function selectLatestSupportedNpmRelease(metadata) {
  const releases = Object.entries(metadata?.versions || {})
    .filter(([version, release]) => {
      const parsed = parseVersion(version);
      return (
        parsed.major === NPM_TARGET_MAJOR &&
        !parsed.prerelease &&
        isSupportedNpmVersion(version) &&
        release?.dist?.tarball
      );
    })
    .sort(([leftVersion], [rightVersion]) =>
      compareVersions(rightVersion, leftVersion)
    );

  if (releases.length === 0) {
    throw new Error(
      `No npm ${NPM_TARGET_MAJOR}.x release found at or above ${NPM_MIN_VERSION}`
    );
  }

  const [version, release] = releases[0];
  return { version, tarballUrl: release.dist.tarball };
}

async function fetchNpmRegistryMetadata(fetchFn) {
  const response = await fetchFn(NPM_REGISTRY_METADATA_URL, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch npm registry metadata: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function resolveLatestSupportedNpmRelease(fetchFn = fetch) {
  return selectLatestSupportedNpmRelease(
    await fetchNpmRegistryMetadata(fetchFn)
  );
}

// Install strategies, in order of preference. Every one of them lands on
// npm@11; only the delivery mechanism differs, so a broken arborist or a
// broken global prefix can still be worked around. The specifier stays a
// literal because command-stream quotes interpolated values.

async function tryStandardInstall($) {
  await $`npm install -g npm@11`;
}

async function tryCurlTarball($, fetchFn) {
  const npmRelease = await resolveLatestSupportedNpmRelease(fetchFn);
  console.log(`Downloading npm ${npmRelease.version} tarball...`);

  const nodeDir = (
    await $`dirname $(dirname $(which node))`.run({ capture: true })
  ).stdout.trim();
  const globalNpmDir = `${nodeDir}/lib/node_modules/npm`;
  const tempNpmDir = '/tmp/setup-npm-package';

  await $`rm -rf "${tempNpmDir}" && mkdir -p "${tempNpmDir}"`;
  await $`curl -fsSL "${npmRelease.tarballUrl}" | tar xz --strip-components=1 -C "${tempNpmDir}" && rm -rf "${globalNpmDir}" && mv "${tempNpmDir}" "${globalNpmDir}"`;
}

async function tryNpxInstall($) {
  await $`npx --yes npm@11 install -g npm@11`;
}

async function tryCorepack($) {
  await $`corepack enable`;
  await $`corepack prepare npm@11 --activate`;
}

async function tryStrategy(name, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    console.warn(`Warning: ${name} failed: ${error.message}`);
    return false;
  }
}

function failUnsupportedNodeVersion(nodeVersion) {
  console.error(
    `ERROR: Node.js ${NODE_MIN_VERSION} or later is required for npm OIDC trusted publishing setup.`
  );
  console.error(`Current Node.js version is ${nodeVersion}.`);
  process.exit(1);
}

function failUnsupportedNpmVersion(npmVersion) {
  console.error(
    `ERROR: Could not update npm to >= ${NPM_MIN_VERSION} for OIDC trusted publishing.`
  );
  console.error(`Current npm version ${npmVersion} does not support OIDC.`);
  console.error('See: https://github.com/actions/runner-images/issues/13883');
  process.exit(1);
}

export async function setupNpm($, fetchFn = fetch) {
  const nodeVersion = process.version;
  console.log(`Current Node.js version: ${nodeVersion}`);

  if (!isSupportedNodeVersion(nodeVersion)) {
    failUnsupportedNodeVersion(nodeVersion);
  }

  const currentResult = await $`npm --version`.run({ capture: true });
  const currentVersion = currentResult.stdout.trim();
  console.log(`Current npm version: ${currentVersion}`);

  const strategies = [
    ['npm install -g npm@11', () => tryStandardInstall($)],
    ['curl-based tarball download', () => tryCurlTarball($, fetchFn)],
    ['npx-based install', () => tryNpxInstall($)],
    ['corepack', () => tryCorepack($)],
  ];

  let success = false;
  for (const [name, fn] of strategies) {
    console.log(`Trying ${name}...`);
    success = await tryStrategy(name, fn);
    if (success) {
      break;
    }
    console.warn(
      'This may be the Node.js 22.22.2 broken npm issue (actions/runner-images#13883).'
    );
  }

  if (!success && isSupportedNpmVersion(currentVersion)) {
    console.log('Current npm version already supports OIDC trusted publishing');
  }

  const updatedResult = await $`npm --version`.run({ capture: true });
  const updatedVersion = updatedResult.stdout.trim();
  console.log(`Updated npm version: ${updatedVersion}`);

  // The publish step needs OIDC. Failing here beats failing with an opaque
  // 401 from the registry three steps later.
  if (!isSupportedNpmVersion(updatedVersion)) {
    failUnsupportedNpmVersion(updatedVersion);
  }
}

function isMainModule() {
  return process.argv[1]
    ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;
}

if (isMainModule()) {
  try {
    if (!isSupportedNodeVersion(process.version)) {
      failUnsupportedNodeVersion(process.version);
    }

    // Load command-stream only for CLI execution, and through the shared
    // use-m loader that normalizes the CommonJS namespace shape Node.js 23+
    // returns (see scripts/use-module.mjs).
    const { useModule } = await import('./use-module.mjs');
    const { $ } = await useModule('command-stream');

    await setupNpm($);
  } catch (error) {
    console.error('Error updating npm:', error.message);
    process.exit(1);
  }
}
