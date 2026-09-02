#!/usr/bin/env node

/**
 * Custom changeset version script that ensures package-lock.json is synchronized
 * with package.json after version bumps.
 *
 * This script:
 * 1. Runs `changeset version` to update package versions
 * 2. Runs `npm install` to synchronize package-lock.json with the new versions
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 */

// Load dependencies through the shared use-m loader, which normalizes the
// CommonJS namespace shape Node.js 23+ returns (see scripts/use-module.mjs).
import { useModule } from './use-module.mjs';

// Import command-stream for shell command execution
const { $ } = await useModule('command-stream');

try {
  console.log('Running changeset version...');
  await $`npx changeset version`;

  console.log('\nSynchronizing package-lock.json...');
  await $`npm install --package-lock-only --legacy-peer-deps`;

  console.log('\n✅ Version bump complete with synchronized package-lock.json');
} catch (error) {
  console.error('Error during version bump:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
