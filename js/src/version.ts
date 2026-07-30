/**
 * Single source of truth for the running version.
 *
 * The version is read from the package manifest, so `--version`, the process
 * log and stored session records can never disagree. See issue #285.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

function read(): string {
  try {
    const require = createRequire(import.meta.url);
    return require('../package.json').version;
  } catch {
    // Fallback: read package.json directly (e.g. when `require` of JSON is
    // unavailable in the current runtime configuration).
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'))
      .version;
  }
}

export const VERSION: string = read();
