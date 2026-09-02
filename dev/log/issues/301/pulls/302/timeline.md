# Timeline

Reconstructed from `ci-logs/`, `meta/` and `git log`. Every line is backed by a
file in this folder or by a commit in this repository.

## Before the issue

| When | Event | Evidence |
| --- | --- | --- |
| 2026-07-04 00:17 UTC | **Rust CI/CD run 28688932169 fails.** The `Auto Release` job dies with `Process completed with exit code 3` and no message. The step began with `CRATE_NAME=$(grep -Po '(?<=^name = ")[^"]*' rust/Cargo.toml)`; `rust/Cargo.toml` has three `name =` lines (package, lib, bin), so `CRATE_NAME` was multi-line, the crates.io URL was malformed, `curl` exited 3 (`URL malformed`) and `bash -e` killed the step silently. | `ci-logs/run-28688932169-failed.log:600-670` |
| 2026-07-27 04:07 UTC | **JS CI/CD run 30236123719 fails** after publishing 0.25.3. | `ci-logs/run-30236123719-failed.log` |
| 2026-07-30 18:57 UTC | **JS CI/CD run 30572373896 fails** after publishing 0.25.4. Both runs print `npm error 404 No match found for version …` immediately before `Version … not found on npm, proceeding with publish...` - the expected answer of an existence probe, rendered as an error. | `ci-logs/run-30572373896-failed.log:540-547` |
| | Both failures are **false positives**: the package was published, then the post-publish verification read the registry before the new version had propagated (`Verification failed: package not found on npm after publish`), and the two retries failed with `packages failed to publish` because the version already existed. Fixed on `main` by `scripts/publish-retry.mjs`. | `ci-logs/run-30236123719-failed.log`, `ci-logs/run-30572373896-failed.log` |
| 2026-08-11 | `command-stream@0.19.0` adds a CommonJS entry point. | npm release history |
| (before #301) | Both of the above are fixed on `main`: the crate name/version now come from a dedicated `crate` step output and `curl` is guarded with `|| echo "000"` (`.github/workflows/rust.yml:272-334`), and the npm existence probe became a registry `fetch` that treats 404 as "not published" (`scripts/npm-registry.mjs`). | working tree |
| 2026-08-11 06:58 UTC | Last **successful** Release job, run 31466957921 (published `js-v0.26.0`). Its `npm install -g npm@latest` step moved the runner from `Current npm version: 11.16.0` to `Updated npm version: 12.0.2` - a major nobody chose. | `ci-logs/release-job-31466957921-success.log:434,441` |

## The run the issue points at

| When | Event | Evidence |
| --- | --- | --- |
| 2026-09-01 19:43:04 UTC | Run **33551125228** starts on `main` for the merge of PR #300 (`f915209`). | `meta/run-33551125228.json` |
| 19:43:07-19:44:39 | All six check jobs pass: three unit-test legs, lint, clean package install, verbose HTTP logging. | `meta/run-33551125228.json` |
| 19:44:43 | `Release` starts. | same |
| 19:45:14 | `npm install` prints `53 vulnerabilities (16 low, 25 moderate, 12 high)` - nothing in the pipeline reads that. | `ci-logs/js-cicd-33551125228.log:9448` |
| 19:45:16 | Step 5, **`Update npm for OIDC trusted publishing`, fails: `Error updating npm: $ is not a function`**. The remaining five steps (changeset check, version, publish, GitHub release, notes) are skipped. | `ci-logs/js-cicd-33551125228-failed.log:436` |
| 19:45:19 | Run concludes `failure`. This is the only failing run on the default branch at the time the issue was filed. | `meta/run-33551125228.json` |
| 2026-09-02 04:54:05 UTC | Issue **#301** is filed. | `gh issue view 301` |

## Warnings present in that same green-looking run

| Count | Warning | Evidence |
| --- | --- | --- |
| 2 | `npm warn deprecated node-domexception@1.0.0` | `js-cicd-33551125228.log` |
| 2 | `53 vulnerabilities (16 low, 25 moderate, 12 high)` | lines 6454, 9448 |
| 1 | `npm warn allow-scripts 2 packages have install scripts not yet covered by allowScripts` (`@parcel/watcher`, `tree-sitter-bash`) | lines 6456-6458 |
| 8 | `warning: in the working copy of '…', LF will be replaced by CRLF` (windows-latest leg) | `js-cicd-33551125228.log` |
| 1 | `System messages in the prompt or messages fields can be a security risk…` (AI SDK) | `js-cicd-33551125228.log` |

## Work in pull request #302

| Commit | What it addresses |
| --- | --- |
| `2122536` | The actual failure of run 33551125228 (Node 24 + use-m). |
| `d3bdf85` | Workflow linting; 23 actionlint/shellcheck and 12 zizmor findings. |
| `132bc74` | Unpinned `npm@latest`, unverified OIDC support. |
| `92ce582` | Concurrency policy test rewritten around principle 10. |
| `5c498b2` | 53 → 36 advisories, 12 high → 0; `allowScripts`. |
| `89783bb` | Security workflow (CodeQL, audits) and the cancelled-job false negative. |
| `b0a0505` | RUSTSEC-2026-0258 in the committed `Cargo.lock`. |
| `8ddfd1b` | AI SDK prompt-injection warning and the Windows CRLF warnings. |
| `acb8ea7` | Per-job concurrency groups and execution budgets for long steps. |
| `7a9f209` | Broken link checker + the link rot it found. |
