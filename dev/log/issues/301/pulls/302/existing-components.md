# Existing components surveyed

The issue asks to check for known components or libraries that solve a similar
problem. Everything below was evaluated against the concrete findings in
[root-causes.md](root-causes.md); the "why" column says what it buys *this*
repository, not what it does in general.

## Adopted

| Component | Version pinned | What it catches here |
| --- | --- | --- |
| [actionlint](https://github.com/rhysd/actionlint) | `rhysd/actionlint:1.7.7` (Docker) | 23 findings in the four existing workflows. The Docker image is used deliberately: it bundles shellcheck, while the bare binary silently skips every `run:` block check. |
| [zizmor](https://github.com/zizmorcore/zizmor) | 1.30.0 | 12 findings, including the `${{ github.base_ref }}` template injection and 11 mutable action tags. Configured through `.github/zizmor.yml` so first-party publishers may use ref-pins and everything else must be hash-pinned. |
| [CodeQL](https://codeql.github.com/) | `github/codeql-action@v4` | JavaScript/TypeScript, Rust, and GitHub Actions queries. |
| [`actions/dependency-review-action`](https://github.com/actions/dependency-review-action) | v4 | Blocks a pull request that introduces a vulnerable dependency, which `npm audit` on `main` would only report after the merge. |
| `npm audit` / [`cargo audit`](https://github.com/rustsec/rustsec) | bundled / `rustsec/audit-check` equivalent run inline | Found the 53 npm advisories and RUSTSEC-2026-0258. |
| [lychee](https://github.com/lycheeverse/lychee) | `lycheeverse/lychee-action@v2` | 50 broken links, 13 of them internal. |
| [Wayback Machine availability API](https://archive.org/help/wayback_api.php) | via `scripts/check-web-archive.mjs` | Keeps a dead-but-archived external link from failing the run while still failing on missing local files. |
| [gitleaks](https://github.com/gitleaks/gitleaks) | already in `js.yml` | Committed secrets. Verified present, unchanged. |

## Evaluated and rejected

| Component | Why not |
| --- | --- |
| [`step-security/harden-runner`](https://github.com/step-security/harden-runner) | Egress filtering would have to allowlist npm, crates.io, the Groq/OpenRouter endpoints and the Wayback Machine; it addresses none of the findings in this issue and would add a new failure mode to every job. |
| [Renovate](https://github.com/renovatebot/renovate) / Dependabot version updates | Would have surfaced RC3/RC4 earlier, but choosing an update cadence is a repository-owner decision. `security.yml`'s weekly audit schedule gives the detection without the automated pull requests. Recorded as a suggestion in [open-findings.md](open-findings.md). |
| [`taiki-e/install-action`](https://github.com/taiki-e/install-action) for `cargo-audit` | The Security workflow installs `cargo-audit` directly; adding a third-party installer for one binary is not worth another hash-pinned dependency. |
| `timeout` (GNU coreutils) instead of `run-with-budget-warning.sh` | `timeout` cannot emit the 70% `::warning::` annotation, does not kill the whole process group, and is not on macOS runners by default. |
| [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) for the push-race fallback | Already used for the changeset PR. For the release path the template's `land-via-pull-request.mjs` is preferred because it must land an *existing* local commit, not create one. |
| `npm-check-updates`, `depcheck` | `depcheck`-style analysis is what found the unused `@actions/*` packages, but the finding is now encoded as a removed dependency; adding the tool to CI would report the many intentional dev-only imports as false positives. |
