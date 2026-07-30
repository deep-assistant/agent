/**
 * Single source of truth for the product identity that is exposed to models
 * and to users.
 *
 * Several system prompts in `src/session/prompt/*.txt` are kept byte-identical
 * to their upstream (opencode) originals so they can be re-synced without
 * conflicts. Instead of editing those files, the identity is substituted at
 * render time by {@link applyBranding}, so a rename is one edit here rather
 * than one edit per prompt file. See issue #285.
 */
export namespace Branding {
  /** Product name as it should appear in prose. */
  export const NAME = 'Agent';
  /** Product name as it appears in a shell (the binary name). */
  export const BINARY = 'agent';
  /** Canonical source repository. */
  export const REPO_URL = 'https://github.com/link-assistant/agent';
  /** Where users should report issues with this tool. */
  export const ISSUES_URL = 'https://github.com/link-assistant/agent/issues';
  /** Where documentation about this tool lives. */
  export const DOCS_URL = 'https://github.com/link-assistant/agent#readme';

  /**
   * Ordered replacements. URLs must be replaced before the bare product name,
   * otherwise the name substitution would corrupt the URLs.
   */
  const REPLACEMENTS: [RegExp, string][] = [
    [/https:\/\/github\.com\/sst\/opencode\/issues/gi, ISSUES_URL],
    [/https:\/\/github\.com\/sst\/opencode/gi, REPO_URL],
    [/https:\/\/opencode\.ai\/docs/gi, DOCS_URL],
    [/https:\/\/opencode\.ai/gi, DOCS_URL],
    [/sst\/opencode/gi, 'link-assistant/agent'],
    [/opencode/gi, NAME],
  ];

  /**
   * Replace every upstream product reference in `text` with this product's
   * identity. Safe to call on text that contains no references.
   */
  export function apply(text: string): string {
    let result = text;
    for (const [pattern, replacement] of REPLACEMENTS) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }
}
