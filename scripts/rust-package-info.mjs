#!/usr/bin/env node

/**
 * Read the crate name and version from the `[package]` section of Cargo.toml.
 *
 * Why this exists: the workflow used to shell out to
 *
 *   CRATE_NAME=$(grep -Po '(?<=^name = ")[^"]*' rust/Cargo.toml)
 *
 * which matches EVERY `name = "..."` at the start of a line — including the one
 * in `[lib]`, in `[[bin]]` and in each of the ~40 `[[test]]` sections. The
 * variable then held a newline-separated list, the crates.io URL built from it
 * was malformed, `curl` exited with code 3, and `set -e` failed the whole
 * "Auto Release" job. See https://github.com/link-assistant/agent/issues/287.
 *
 * Parsing is scoped to the `[package]` section so extra `[[bin]]`/`[[test]]`
 * sections can never influence the result.
 *
 * Usage:
 *   import { readCrateInfo } from './rust-package-info.mjs';
 *
 * CLI (writes name/version to $GITHUB_OUTPUT and stdout):
 *   node scripts/rust-package-info.mjs
 */

import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCargoTomlPath } from './rust-paths.mjs';

/**
 * Read a string key from the `[package]` section of a Cargo.toml body.
 * @param {string} cargoTomlContent
 * @param {string} key
 * @returns {string|null} The value, or null when the key is absent
 */
export function readPackageKey(cargoTomlContent, key) {
  let inPackageSection = false;

  for (const rawLine of String(cargoTomlContent || '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith('[')) {
      // `[package]` is a table; `[[package]]` or any other header ends it.
      inPackageSection = line === '[package]';
      continue;
    }

    if (!inPackageSection) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"/);
    if (match && match[1] === key) {
      return match[2];
    }
  }

  return null;
}

/**
 * Rewrite the `version` key of the `[package]` section, leaving every other
 * section untouched. A bare `/^version\s*=\s*"[^"]+"/m` replacement would edit
 * whichever `version = "…"` line comes first in the file.
 * @param {string} cargoTomlContent
 * @param {string} newVersion
 * @returns {string} The updated Cargo.toml body
 */
export function setPackageVersion(cargoTomlContent, newVersion) {
  let inPackageSection = false;
  let replaced = false;

  const lines = String(cargoTomlContent)
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trim();

      if (line.startsWith('[')) {
        inPackageSection = line === '[package]';
        return rawLine;
      }

      if (!inPackageSection || replaced) {
        return rawLine;
      }

      const match = rawLine.match(/^(\s*version\s*=\s*")[^"]*(".*)$/);
      if (!match) {
        return rawLine;
      }

      replaced = true;
      return `${match[1]}${newVersion}${match[2]}`;
    });

  if (!replaced) {
    throw new Error('No version key found in the [package] section');
  }

  return lines.join('\n');
}

/**
 * Parse crate name and version from a Cargo.toml body.
 * @param {string} cargoTomlContent
 * @param {string} cargoTomlPath - Only used for error messages
 * @returns {{name: string, version: string}}
 */
export function parseCrateInfo(cargoTomlContent, cargoTomlPath = 'Cargo.toml') {
  const name = readPackageKey(cargoTomlContent, 'name');
  if (!name) {
    throw new Error(`Crate name is missing in [package] of ${cargoTomlPath}`);
  }

  const version = readPackageKey(cargoTomlContent, 'version');
  if (!version) {
    throw new Error(
      `Crate version is missing in [package] of ${cargoTomlPath}`
    );
  }

  return { name, version };
}

/**
 * Read crate name and version from the detected Rust package root.
 * @param {Object} options - Configuration options (passed to getCargoTomlPath)
 * @returns {{name: string, version: string}}
 */
export function readCrateInfo(options = {}) {
  const cargoTomlPath = getCargoTomlPath(options);
  return parseCrateInfo(readFileSync(cargoTomlPath, 'utf8'), cargoTomlPath);
}

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`Output: ${key}=${value}`);
}

function isCliEntryPoint() {
  return (
    process.argv?.[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  );
}

if (isCliEntryPoint()) {
  const { name, version } = readCrateInfo();
  setOutput('name', name);
  setOutput('version', version);
}
