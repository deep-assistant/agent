# Requirements of issue #301, enumerated

The issue text, split into every separable obligation. Status is as of the head
of `issue-301-ef35bbf03fb8`.

## R1 — "Check for all **false positives** … in CI/CD and fix them"

A false positive here is CI reporting a problem that is not one.

| # | Finding | Status |
| --- | --- | --- |
| R1.1 | `npm error 404 No match found for version X` printed by the publish existence probe on every release (`ci-logs/run-30572373896-failed.log:540`). | Already fixed on `main` before this issue: `scripts/npm-registry.mjs` fetches registry metadata and treats 404 as "not published". Documented, no change needed. |
| R1.2 | The concurrency policy test reported the new check-only workflow as unprotected because it only recognised workflow-level `concurrency:`. | Fixed — `92ce582`. |
| R1.3 | `bun test` invoked without an explicit file list matches only `*.test.*`, so a green "all tests pass" can mean "no tests ran". | Verified not present: `js/package.json` pins the file list. Documented in [open-findings.md](open-findings.md). |
| R1.4 | Runs 30236123719 and 30572373896 went red *after a successful publish*: the post-publish check read npm's registry before the new version had propagated, reported "Verification failed: package not found on npm after publish", and two republish attempts then failed with "packages failed to publish" because the version already existed. | Already fixed on `main` before this issue: `scripts/publish-retry.mjs` treats propagation lag as retryable and `isAlreadyPublishedError` treats "already exists" as success. Documented, no change needed. |
| R1.5 | `Dependency review is not supported on this repository` failed the Security workflow on every pull request because the dependency graph is disabled for the repository - a settings gap, not a dependency problem. | Fixed — `9e5131f`; see [root-causes.md](root-causes.md) RC11. |

## R2 — "… all **false negatives** …"

CI staying green while something is wrong.

| # | Finding | Status |
| --- | --- | --- |
| R2.1 | A job killed by `timeout-minutes` is reported by GitHub as **cancelled**, not failed. Every release gate reads `needs.<job>.result == 'success'`, so a timed-out check silently skipped the release and the run stayed green. | Fixed — `89783bb` adds a `pipeline-status` job and `scripts/check-pipeline-status.sh` (unit-tested) to both pipelines. |
| R2.2 | `bun add "$TARBALL" 2>&1 \| tee install.log` reported `tee`'s exit status (no `pipefail`), so a broken clean install left the job green. | Fixed — `d3bdf85`. |
| R2.3 | `npx prettier --write ".changeset/*.md" \|\| true` swallowed real formatting failures, producing changeset PRs that then failed `format:check`. | Fixed — `d3bdf85`. |
| R2.4 | `cat ~/.config/opencode/opencode.json \|\| echo "not found"` in the integration workflow hid a broken `mcp add`. | Fixed — `d3bdf85`. |
| R2.5 | `npm install -g npm@latest` was never checked; a failed install left the job on the runner's npm, which can be below the 11.5.1 OIDC minimum, and the failure only surfaced later as an opaque registry error. | Fixed — `132bc74`. |
| R2.6 | Nothing scanned dependencies: 53 npm advisories (12 high) and RUSTSEC-2026-0258 in `Cargo.lock` sat in the tree unnoticed. | Fixed — `89783bb` (Security workflow: CodeQL, dependency review, `npm audit`, `cargo audit`, weekly schedule), `5c498b2`, `b0a0505`. |
| R2.7 | No step-level execution budget: a slow step ran until the job-level `timeout-minutes` and then produced R2.1's silent cancellation. | Fixed — `acb8ea7` adds `scripts/run-with-budget-warning.sh` (from the JS template) around the six long-running steps. |
| R2.8 | Nothing checked the workflow files themselves, so shell bugs inside `run:` blocks only surfaced as production failures. | Fixed — `d3bdf85` adds `.github/workflows/workflows.yml` (actionlint + shellcheck + zizmor). |
| R2.9 | No link checking: 50 lychee errors in the tree, including 13 documentation links pointing at test files renamed months ago. | Fixed — `7a9f209`. |

## R3 — "… all **warnings** …"

| # | Warning | Status |
| --- | --- | --- |
| R3.1 | `npm warn allow-scripts` for `@parcel/watcher@2.5.1` and `tree-sitter-bash@0.25.1` - their native builds were being skipped. | Fixed — `5c498b2` (`allowScripts` in `js/package.json`). |
| R3.2 | `53 vulnerabilities (16 low, 25 moderate, 12 high)` on every `npm install`. | Fixed — `5c498b2`: 36 advisories, 0 high, 0 critical. |
| R3.3 | 8× `LF will be replaced by CRLF` on the windows-latest leg. | Fixed — `8ddfd1b` (`core.autocrlf=false` in the fixture repositories). |
| R3.4 | AI SDK: `System messages in the prompt or messages fields can be a security risk because they may enable prompt injection attacks.` | Fixed — `8ddfd1b`, with a regression test that pins both the warning and its absence. |
| R3.5 | `npm warn deprecated node-domexception@1.0.0`. | Not actionable here - see [open-findings.md](open-findings.md). |
| R3.6 | `git init` default-branch hint on every checkout. | Already fixed on `main` via `GIT_CONFIG_*` env; verified present in all four pre-existing workflows and carried into the two new ones. |

## R4 — "… and **errors** … and fix them all"

| # | Error | Status |
| --- | --- | --- |
| R4.1 | Run 33551125228: `Error updating npm: $ is not a function` in `Update npm for OIDC trusted publishing`. | Fixed — `2122536`; root cause in [root-causes.md](root-causes.md#rc1). |
| R4.2 | 23 actionlint/shellcheck findings across the four workflows. | Fixed — `d3bdf85`. |
| R4.3 | 12 zizmor findings, including a `${{ github.base_ref }}` template injection in `rust.yml` and 11 unpinned third-party actions. | Fixed — `d3bdf85`. |

## R5 — "Use all the best practices from CI/CD templates (check the full file tree to compare for all GitHub workflow and CI/CD script files)"

Both templates were cloned and compared file by file; see
[solution-plans.md](solution-plans.md#r5-template-comparison) for the full
per-file table of what was adopted, what was already present and what was
deliberately skipped.

## R6 — "If the same issue is found in a template, report the issue in the templates too"

Three reports filed, each with a reproduction, a workaround and a code fix:

| Upstream | Report |
| --- | --- |
| `link-foundation/use-m` | [comment on #72](https://github.com/link-foundation/use-m/issues/72#issuecomment-5505355202) - fresh Node 24.20.0 reproduction of the CommonJS-namespace bug plus the `'module.exports'` metadata-key fix |
| `link-foundation/js-ai-driven-development-pipeline-template` | [#151](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/151) - the same `const { $ } = await use('command-stream')` pattern in `setup-npm.mjs` and seven sibling scripts, on `node-version: '24.x'` runners |
| `link-foundation/rust-ai-driven-development-pipeline-template` | [#145](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/145) - workflow-scoped `main-write` concurrency group does not serialize `main` writers from another workflow |

See [solution-plans.md](solution-plans.md#r6-upstream-reports).

## R7 — "Follow the CI/CD best practices collected in hive-mind/docs/CI-CD-BEST-PRACTICES.md"

Every principle checked against both pipelines; principle 10 (per-job
concurrency, non-cancellable writers) is now encoded as a unit test in
`js/tests/workflow-policy.js` so it cannot regress.

## R8 — "Plan and execute everything in this single pull request"

All work is on `issue-301-ef35bbf03fb8` / PR #302. No other branch is touched.

## R9 (from the task brief) — collect the evidence into `dev/log/issues/301/pulls/302`

This folder. See [README.md](README.md).
