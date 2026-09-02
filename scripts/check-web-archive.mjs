#!/usr/bin/env node

/**
 * Check broken links against the Wayback Machine (web.archive.org)
 *
 * This script reads the lychee link checker output (markdown format),
 * extracts broken URLs, and checks each one against the Wayback Machine API.
 * It then outputs a report with:
 * - Links that have a web archive version (with suggestion to replace)
 * - Links that have no web archive version (clearly marked as unrecoverable)
 *
 * Usage:
 *   node scripts/check-web-archive.mjs
 *
 * Environment variables:
 *   - LYCHEE_OUTPUT: Path to lychee markdown output file (default: lychee/out.md)
 *
 * GitHub Actions outputs:
 *   - all_archived: 'true' if all broken links have a web archive version
 *
 * Exit codes:
 *   - 0: All broken links have web archive versions (or no broken links)
 *   - 1: Some broken links have no web archive version
 */

import { readFileSync, appendFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';

const WAYBACK_API = 'https://archive.org/wayback/available?url=';

/**
 * Write output to GitHub Actions output file
 * @param {string} name - Output name
 * @param {string} value - Output value
 */
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
}

/**
 * Extract the "Errors per input" section of a lychee markdown report.
 *
 * Everything after it - most importantly "## Redirects per input" - describes
 * links that resolved successfully, so scanning the whole report would make
 * redirected links look broken. Legacy reports that have no such heading are
 * scanned in full; the entry pattern below only matches bullets that carry a
 * status marker, so redirect lines cannot leak in.
 * @param {string} content - The markdown content from lychee
 * @returns {string} The errors section, or the whole report when there is none
 */
export function extractErrorsSection(content) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) =>
    /^#+\s+Errors per input\s*$/.test(line)
  );
  if (start === -1) {
    return content;
  }
  const heading = /^(#+)\s/.exec(lines[start])[1].length;
  const section = [];
  for (const line of lines.slice(start + 1)) {
    const next = /^(#+)\s/.exec(line);
    if (next && next[1].length <= heading) {
      break; // a sibling or parent heading ends the errors section
    }
    section.push(line);
  }
  return section.join('\n');
}

/**
 * Extract broken links from lychee markdown output.
 * Lychee markdown format includes lines like:
 *   * [404] <https://example.com/broken-link> (at 1:1) | Rejected status code: 404
 *   * [ERROR] <file:///repo/missing.yml> (at 15:12) | File not found
 *   * [ERROR] <error:> (at 10:49) | Cannot resolve root-relative link '/favicon.svg'
 * @param {string} content - The markdown content from lychee
 * @returns {{urls: string[], others: string[]}} Broken http(s) URLs, and broken
 *   links that cannot be looked up in the Wayback Machine (missing local files,
 *   unresolvable root-relative links, ...)
 */
export function extractBrokenLinks(content) {
  const section = extractErrorsSection(content);
  const urls = [];
  const others = [];

  // One bullet per broken link; the status marker is always present. Matching
  // the marker instead of an `https?://` prefix is what keeps non-HTTP errors
  // from being silently dropped.
  const entryPattern =
    /^\s*(?:\*|-)\s+\[(?:4\d\d|5\d\d|ERROR|TIMEOUT|UNKNOWN)\]\s+<?([^\s>|)]+)>?/gim;
  let match;

  while ((match = entryPattern.exec(section)) !== null) {
    const link = match[1].trim().replace(/[.,;!?]+$/, '');
    if (!link) {
      continue;
    }
    if (/^https?:\/\//i.test(link)) {
      if (!urls.includes(link)) {
        urls.push(link);
      }
    } else if (!others.includes(link)) {
      others.push(link);
    }
  }

  return { urls, others };
}

/**
 * Extract broken http(s) URLs from lychee markdown output.
 * Kept for callers that only care about links the Wayback Machine can answer.
 * @param {string} content - The markdown content from lychee
 * @returns {string[]} Array of broken URLs
 */
export function extractBrokenUrls(content) {
  return extractBrokenLinks(content).urls;
}

/**
 * Check if a URL has an archived version in the Wayback Machine
 * Uses the Wayback Machine Availability API:
 * https://archive.org/help/wayback_api.php
 * @param {string} url - The URL to check
 * @returns {Promise<{available: boolean, archiveUrl: string|null, timestamp: string|null}>}
 */
async function checkWaybackMachine(url) {
  const apiUrl = `${WAYBACK_API}${encodeURIComponent(url)}`;

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'broken-link-checker/1.0 (GitHub Actions CI)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`  Wayback API returned ${response.status} for ${url}`);
      return { available: false, archiveUrl: null, timestamp: null };
    }

    const data = await response.json();

    if (data.archived_snapshots?.closest?.available === true) {
      const snapshot = data.archived_snapshots.closest;
      const archiveUrl = snapshot.url.replace(/^http:\/\//, 'https://');
      return {
        available: true,
        archiveUrl,
        timestamp: snapshot.timestamp,
      };
    }

    return { available: false, archiveUrl: null, timestamp: null };
  } catch (error) {
    console.warn(
      `  Failed to check Wayback Machine for ${url}: ${error.message}`
    );
    return { available: false, archiveUrl: null, timestamp: null };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

/**
 * Format a timestamp from Wayback Machine (YYYYMMDDHHmmss) to readable date
 * @param {string} timestamp - e.g. "20231015143022"
 * @returns {string} - e.g. "2023-10-15"
 */
function formatTimestamp(timestamp) {
  if (!timestamp || timestamp.length < 8) {
    return timestamp;
  }
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Main function
 */
async function main() {
  const lycheeOutput = process.env.LYCHEE_OUTPUT || 'lychee/out.md';

  console.log('=== Web Archive Fallback Check ===\n');
  console.log(`Reading lychee output from: ${lycheeOutput}\n`);

  if (!existsSync(lycheeOutput)) {
    console.log('No lychee output file found. Skipping web archive check.');
    setOutput('all_archived', 'true');
    process.exit(0);
  }

  const content = readFileSync(lycheeOutput, 'utf-8');
  const { urls: brokenUrls, others: unarchivableLinks } =
    extractBrokenLinks(content);

  if (unarchivableLinks.length > 0) {
    // Missing local files and unresolvable root-relative links have no Wayback
    // equivalent. Reporting `all_archived=true` for them turned a real lychee
    // failure into a green run (issue #136).
    console.log(
      `\u2717 ${unarchivableLinks.length} broken link(s) cannot be checked against the Web Archive:`
    );
    for (const link of unarchivableLinks) {
      console.log(`  ${link}`);
      console.log(
        '::error title=Broken link - not recoverable from the Web Archive::' +
          `Broken link detected: ${link}\n` +
          'It is not an http(s) URL (missing file, unresolvable relative link, ...),\n' +
          'so the Wayback Machine cannot provide a fallback.\n' +
          'How to fix: correct the path, restore the missing file, or pass --root-dir\n' +
          'to lychee so root-relative links resolve.'
      );
    }
    console.log('');
  }

  if (brokenUrls.length === 0) {
    console.log('No broken URLs found in lychee output.');
    const clean = unarchivableLinks.length === 0;
    setOutput('all_archived', clean ? 'true' : 'false');
    process.exit(clean ? 0 : 1);
  }

  console.log(
    `Found ${brokenUrls.length} broken URL(s). Checking Web Archive...\n`
  );

  const withArchive = [];
  const withoutArchive = [];

  for (const url of brokenUrls) {
    console.log(`Checking: ${url}`);
    const result = await checkWaybackMachine(url);

    if (result.available) {
      const date = formatTimestamp(result.timestamp);
      console.log(`  ✓ Archived on ${date}: ${result.archiveUrl}`);
      withArchive.push({ url, archiveUrl: result.archiveUrl, date });
    } else {
      console.log('  ✗ Not found in Web Archive');
      withoutArchive.push(url);
    }

    // Small delay to avoid rate-limiting the Wayback API
    await new Promise((resolve) => globalThis.setTimeout(resolve, 500));
  }

  console.log('\n=== Web Archive Check Summary ===\n');

  if (withArchive.length > 0) {
    console.log(
      `✓ ${withArchive.length} broken link(s) have Web Archive versions - consider replacing:`
    );
    for (const { url, archiveUrl, date } of withArchive) {
      console.log(`  Original: ${url}`);
      console.log(`  Archive (${date}): ${archiveUrl}`);
      console.log('');
    }

    // Print GitHub Actions annotations as suggestions (one per link)
    for (const { url, archiveUrl, date } of withArchive) {
      console.log(
        `::notice title=Broken link - Web Archive available (${date})::` +
          `Broken link detected: ${url}\n` +
          `A Web Archive snapshot from ${date} is available.\n` +
          `Suggested fix: replace the broken link with the archived version:\n` +
          `  ${archiveUrl}`
      );
    }
  }

  if (withoutArchive.length > 0) {
    console.log(
      `✗ ${withoutArchive.length} broken link(s) have NO Web Archive version:`
    );
    for (const url of withoutArchive) {
      console.log(`  ${url}`);
    }
    console.log('');

    // Print GitHub Actions annotations as errors (one per link)
    for (const url of withoutArchive) {
      console.log(
        `::error title=Broken link - No Web Archive fallback::` +
          `Broken link detected: ${url}\n` +
          `No archived version was found in the Wayback Machine.\n` +
          `How to fix:\n` +
          `  1. Find an updated URL for the same or equivalent content and replace the link.\n` +
          `  2. Remove the link if the content is no longer relevant.\n` +
          `  3. Add the URL to .lycheeignore if it is a known false positive (e.g. localhost, example.com).`
      );
    }
  }

  const allArchived =
    withoutArchive.length === 0 && unarchivableLinks.length === 0;
  setOutput('all_archived', allArchived ? 'true' : 'false');

  if (!allArchived) {
    console.log(
      '\nAction required: Fix or remove the broken links listed above.'
    );
    console.log(
      'For links with Web Archive versions, you can replace them with the suggested archive.org URLs.'
    );
    process.exit(1);
  } else {
    console.log(
      '\nAll broken links have Web Archive versions. Consider replacing them with the suggested archive.org URLs.'
    );
    process.exit(0);
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
