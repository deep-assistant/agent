/**
 * Minimal crates.io registry client.
 *
 * Mirrors scripts/npm-registry.mjs so both release pipelines determine
 * "is this exact version published?" the same way: a direct metadata request,
 * with 404 meaning "not published" and network errors surfacing to the caller
 * so they can be treated as "unknown" rather than "absent".
 */

export const DEFAULT_CRATES_API_URL = 'https://crates.io/api/v1/crates';

// crates.io rejects requests without a descriptive User-Agent.
export const DEFAULT_USER_AGENT = 'link-assistant-agent-ci';

/**
 * Strip trailing slashes from a registry base URL.
 * @param {string} registryUrl
 * @returns {string}
 */
export function normalizeCratesApiUrl(registryUrl = DEFAULT_CRATES_API_URL) {
  return String(registryUrl).replace(/\/+$/, '');
}

/**
 * Build the metadata URL for one crate version.
 * @param {string} crateName
 * @param {string} version
 * @param {string} [registryUrl]
 * @returns {string}
 */
export function buildCrateVersionUrl(
  crateName,
  version,
  registryUrl = DEFAULT_CRATES_API_URL
) {
  return `${normalizeCratesApiUrl(registryUrl)}/${encodeURIComponent(
    crateName
  )}/${encodeURIComponent(version)}`;
}

/**
 * Check whether an exact crate version is published on crates.io.
 * @param {string} crateName
 * @param {string} version
 * @param {object} [options]
 * @param {Function} [options.fetchFn]
 * @param {string} [options.registryUrl]
 * @returns {Promise<boolean>}
 */
export async function isCrateVersionPublished(
  crateName,
  version,
  { fetchFn = globalThis.fetch, registryUrl = DEFAULT_CRATES_API_URL } = {}
) {
  const response = await fetchFn(
    buildCrateVersionUrl(crateName, version, registryUrl),
    { headers: { 'user-agent': DEFAULT_USER_AGENT } }
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(
      `crates.io responded with ${response.status} for ${crateName}@${version}`
    );
  }

  const metadata = await response.json();
  return metadata?.version?.num === version;
}
