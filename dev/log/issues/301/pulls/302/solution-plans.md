# Solution plans

For each requirement: the options that were on the table, the one chosen, and
why. Where a requirement is not fully closed, the remaining plan is written out
so the next iteration can pick it up.

## R1/R4 — the failing run

Options for RC1 (`$ is not a function`):

| Option | Verdict |
| --- | --- |
| Pin `node-version` back to 20.x in the Release job | Rejected: hides the bug, and the OIDC publish path wants a current Node. |
| Pin `use-m` to a version before the CJS interop change | Rejected: 8.15.0 *is* the latest; there is no good version. |
| Drop `use-m` and import `command-stream` directly | Rejected here: nine scripts depend on the loader, and use-m is the ecosystem convention in these repositories. |
| **Normalize the namespace in one shared loader** | **Chosen** (`scripts/use-module.mjs`): one place to fix, works on Node 20 and 24, and is unit-tested. |
| Fix it upstream in use-m | Also pursued - <https://github.com/link-foundation/use-m/issues/72>. The local loader is what makes the pipeline green today. |

## R2 — false negatives

The general plan was: for each way the pipeline could stay green while wrong,
add a mechanism that *observes* the condition, and a unit test that pins the
mechanism.

- Cancelled-job blindness → `scripts/check-pipeline-status.sh` + a
  `pipeline-status` job in both pipelines + `js/tests/check-pipeline-status.js`.
- Overrunning steps → `scripts/run-with-budget-warning.sh` +
  `js/tests/run-with-budget-warning.js`.
- Unlinted workflows → `.github/workflows/workflows.yml` (actionlint + zizmor).
- Unscanned dependencies → `.github/workflows/security.yml`.
- Unchecked links → `.github/workflows/links.yml`.
- Policy drift → `js/tests/workflow-policy.js`, which asserts the concurrency
  shape of every workflow file rather than of a hard-coded list.

## R5 — template comparison <a id="r5-template-comparison"></a>

Both templates were cloned and every workflow and script compared.

### Workflows

| Template file | This repository |
| --- | --- |
| `workflows.yml` | **Adopted** (`d3bdf85`). |
| `security.yml` | **Adopted** and extended with `cargo audit` for the Rust crate (`89783bb`). |
| `links.yml` | **Adopted** (`7a9f209`). |
| `release.yml` | Already present in a repository-specific form as `js.yml` / `rust.yml`; the practices inside it were merged in rather than the file. |
| `example-app.yml`, `desktop-release.yml` | Not applicable - no example app, no desktop bundle. |

### Scripts

| Template script | Disposition |
| --- | --- |
| `check-pipeline-status.sh` | **Adopted** (`89783bb`), with tests. |
| `run-with-budget-warning.sh` | **Adopted** (`acb8ea7`), with tests. |
| `check-web-archive.mjs` (+ fixture, + test) | **Adopted** (`7a9f209`), test ported to `bun:test`. |
| `setup-npm.mjs` | Already present; the template's npm pinning, Node floor and OIDC assertion were merged in (`132bc74`). |
| `changeset-version.mjs`, `create-github-release.mjs`, `create-manual-changeset.mjs`, `format-github-release.mjs`, `format-release-notes.mjs`, `instant-version-bump.mjs`, `js-paths.mjs`, `npm-registry.mjs`, `package-info.mjs`, `publish-failure-classifier.mjs`, `publish-retry.mjs`, `publish-to-npm.mjs`, `simulate-fresh-merge.sh`, `validate-changeset.mjs`, `version-and-commit.mjs` | Already present and equivalent. |
| `check-file-line-limits.sh` | Equivalent already present: `scripts/check-file-size.mjs` (1000-line limit) wired into `npm run check`. |
| `check-mjs-syntax.sh` | Not adopted: `npm run lint:scripts` already parses every `scripts/*.mjs` with ESLint, which fails on a syntax error. |
| `wait-for-npm.mjs` | Not adopted: `scripts/publish-retry.mjs` already polls the registry after publishing and distinguishes propagation lag from a publish failure. |
| `smoke-test-package.mjs` | Not adopted: the `Clean Package Install` job already packs the tarball and installs it into an empty project on every run. |
| `sanitize-npm-userconfig.mjs` | Not adopted: it exists to silence an `always-auth` warning from older `setup-node`; `grep -i always-auth` finds nothing in any collected log, because `setup-node@v6` no longer writes it. |
| `check-changesets.mjs`, `check-release-needed.mjs` | Not adopted as files: the equivalent gates exist inline in `js.yml`/`rust.yml` (`Check for changesets`, and the tag/release/registry recovery logic in `rust.yml:272-345`). |
| `detect-code-changes.mjs` | **Deliberately not adopted** - see below. |
| `merge-changesets.mjs` | Not adopted: `validate-changeset.mjs` enforces exactly one changeset per PR, so multiple pending changesets cannot accumulate. |
| `push-main-with-rebase-retry.mjs`, `land-via-pull-request.mjs`, `push-failure-classifier.mjs`, `run-command.mjs` | **Gap identified** - see below. |
| `lint.mjs`, `lint-changed-lines.mjs` | Not adopted: linting runs through `npm run check` (ESLint + Prettier + file size). |
| `check-docker-build.mjs`, `check-docker-publish.mjs`, `update-preview-images.mjs`, `release-naming.mjs` | Not applicable / covered by the explicit `js-` and `rust-` prefixes already passed to the release scripts. |
| Rust template's `*.rs` scripts (`check-cargo-lock.rs`, `get-version.rs`, …) | Not applicable: this repository implements the same steps in `scripts/rust-*.mjs`, because the JS toolchain is already a dependency here. |

**`detect-code-changes.mjs` — considered and not adopted.** It lets a
docs-only change skip the release-relevant checks and the changeset
requirement. This repository's `validate-changeset.mjs` requires exactly one
changeset on *every* pull request, docs included. Adopting the template script
would silently change the repository's release policy, which is an owner
decision, not a CI defect. Recorded in [open-findings.md](open-findings.md).

**Push-race gap.** `scripts/version-and-commit.mjs:260` and
`scripts/rust-version-and-commit.mjs` end with a bare `git push origin main`.
If another writer lands on `main` between the rebase and the push, or a
repository ruleset forbids direct pushes, the push is rejected *after* the
version bump has already been committed in the runner. The template solved
exactly this in its issue #143 with `push-main-with-rebase-retry.mjs`
(rebase-and-retry) falling back to `land-via-pull-request.mjs` (GH013/GH006).
No occurrence is visible in the collected logs, so this is a latent gap rather
than an observed failure; it is tracked in [open-findings.md](open-findings.md)
with the adoption plan.

## R6 — upstream reports <a id="r6-upstream-reports"></a>

| Repository | What to report | Status |
| --- | --- | --- |
| `link-foundation/use-m` | The Node 23+ CommonJS namespace interop bug, with the reproduction from [root-causes.md](root-causes.md#rc1) and the normalization fix. | Reported: comment on [use-m#72](https://github.com/link-foundation/use-m/issues/72#issuecomment-5505355202) with a fresh Node 24.20.0 reproduction, the downstream incident and the `'module.exports'` metadata-key fix. |
| `link-foundation/js-ai-driven-development-pipeline-template` | The same pattern lives in its `setup-npm.mjs` and seven sibling scripts (`const { $ } = await use('command-stream')`), so the template will fail the same way on a Node 24 runner. Report must carry the reproduction, the workaround and the `use-module.mjs` shape. | Reported: [js-template#151](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/151). |
| `link-foundation/rust-ai-driven-development-pipeline-template` | Not affected by the `use-m` bug: its scripts are `rust-script`. It does deviate from best-practice §10 though - all four writer jobs in `release.yml` use a workflow-scoped `${{ github.workflow }}-main-write` group, so `main` writers from another workflow are not serialized (the JS template already uses `main-writer-${{ github.repository }}-main`). | Reported: [rust-template#145](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/145). |

## R7 — CI-CD-BEST-PRACTICES

Principle 10 asks for per-job `check-*` groups that cancel off `main`, plus a
single non-cancellable `main-writer-${{ github.repository }}-main` group shared
by everything that writes to `main`. This repository had one group per
*workflow* (`js-${{ github.workflow }}-${{ github.ref }}`, correctly
non-cancellable on `main`), which is safe but too coarse in two ways: a new
push to a branch cancelled that branch's slow and fast checks together, and -
more importantly - the JS and Rust release jobs sat in *different* groups, so
two writers could push to `main` at the same time. That is precisely the race
`scripts/version-and-commit.mjs` cannot recover from (see the push-race gap
above). `acb8ea7` converts all six workflows, and `js/tests/workflow-policy.js`
now fails if a workflow declares neither shape, or lets a writer job be
cancelled.
