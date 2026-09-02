# Root causes

One section per defect: the symptom exactly as it appears in the evidence, the
mechanism, and the fix.

## RC1 — `Error updating npm: $ is not a function` <a id="rc1"></a>

**Symptom** (`ci-logs/js-cicd-33551125228-failed.log:436`):

```
Release  2026-09-01T19:45:16.4504584Z Error updating npm: $ is not a function
```

The step is `Update npm for OIDC trusted publishing`, running
`node scripts/setup-npm.mjs` on `node-version: 24.x`
(`ci-logs/js-cicd-33551125228.log:375`). All five later steps were skipped, so
`js-v0.26.1` was never published.

**Mechanism.** `setup-npm.mjs` did:

```js
const { $ } = await use('command-stream');
```

Node.js 23 added a synthetic `module.exports` named export to CommonJS
namespace objects. `use-m@8.15.0` decides whether to unwrap a CommonJS
`default` by asking whether the namespace has named exports other than
`default`; the synthetic marker makes that check answer "yes", so `use()`
returns the namespace instead of the callable `module.exports`. Destructuring
`$` off it yields `undefined`, and the first call throws
`$ is not a function`.

The latent bug became reachable only when `command-stream@0.19.0` (2026-08-11)
added a CommonJS entry point - the same day as the last green release, which
is why the failure appeared without any change to this repository.

**Reproduction** (`node >= 23`):

```js
import { use } from 'use-m'; // 8.15.0
const mod = await use('command-stream@0.19.0');
console.log(typeof mod.$);         // 'undefined'
console.log(typeof mod.default.$); // 'function'
```

**Fix** — `2122536`: `scripts/use-module.mjs` loads use-m once and normalizes
the namespace (prefer a `default` that is callable or that carries the expected
named exports), and all nine release scripts go through it.
`CI_SCRIPTS_DEBUG=1` prints the resolved shape; the default is off.
Upstream: <https://github.com/link-foundation/use-m/issues/72>.

## RC2 — a timed-out job leaves the run green

**Mechanism.** GitHub reports a job killed by `timeout-minutes` with
`conclusion: cancelled`. Both pipelines gate the release on
`needs.<job>.result == 'success'`, and a `cancelled` result is simply "not
success": the release is skipped, no job is red, the run is green, and the
version silently never ships. Nothing in the workflow observes it, because
`if: always()` on a status job also runs when the *whole run* was cancelled by
a human, which is why `always()` cannot be used to express this.

**Fix** — `89783bb`: a `pipeline-status` job that `needs` every other job, runs
under `if: ${{ !cancelled() }}`, and feeds `needs` into
`scripts/check-pipeline-status.sh`, which fails the run when any job is
`failure` **or** `cancelled` while the run itself was not cancelled. Unit
tests in `js/tests/check-pipeline-status.js`.

**Fix (prevention)** — `acb8ea7`: `scripts/run-with-budget-warning.sh` wraps
the six long steps with a budget below the job timeout, emitting
`::warning title=<label> is approaching its execution budget::` at 70% and
`::error …exceeded its execution budget::` plus exit 124 at 100%. A step that
overruns now fails loudly instead of being cancelled silently.

## RC3 — 53 npm advisories, 12 high

**Mechanism.** `@actions/core` and `@actions/github` were declared as runtime
dependencies but imported nowhere. They were the only packages that loaded
`undici`, and they dragged in a second Octokit tree (5.x) beside the 7.x this
code uses. Separately, `@ai-sdk/provider-utils@3.0.36` declares
`undici: ^5.29.0` but never imports it (the only occurrence in the published
package is a comment); 5.29.0 is the last 5.x and carries three high-severity
WebSocket advisories with no fix inside the declared range.

**Fix** — `5c498b2`: remove the unused packages, `npm audit fix
--package-lock-only` for the non-breaking rest, and an `overrides.undici: ^7`
that moves the never-loaded package out of advisory range. Result: 36
advisories, 0 high, 0 critical.

## RC4 — RUSTSEC-2026-0258 in the committed `Cargo.lock`

`h2 0.4.15` is vulnerable to unbounded empty DATA frames (fixed in 0.4.16).
Nothing read the Rust lockfile before this branch added `cargo audit`.
**Fix** — `b0a0505`: `h2` to 0.4.19, verified with `cargo check --locked`.

## RC5 — unpinned `npm@latest` and unverified OIDC support

`scripts/setup-npm.mjs` ran a bare `npm install -g npm@latest` and ignored the
result. Two consequences, both observed:

1. Run 31466957921 silently moved the runner from npm 11.16.0 to 12.0.2
   (`ci-logs/release-job-31466957921-success.log:434,441`) - a major the
   publish path was never tested against.
2. A failed install left whatever npm the runner shipped. Node.js 22.22.2 on
   ubuntu-24.04 ships a broken npm 10.9.7
   (<https://github.com/actions/runner-images/issues/13883>), below the 11.5.1
   OIDC trusted-publishing minimum, so publishing failed later with an opaque
   registry error instead of here with a clear one.

**Fix** — `132bc74`: pin `npm@11`, gate on the Node.js floor, four fallback
install strategies, and assert the resulting npm supports OIDC before the
release continues. Pure helpers covered by `js/tests/setup-npm.js`.

## RC6 — nothing linted the workflows

**Mechanism.** The four workflow files were only ever "tested" by running the
pipeline. actionlint (with shellcheck) found 23 issues and zizmor found 12,
including a `${{ github.base_ref }}` interpolated straight into a `run:` block
(a branch name is attacker-controlled on a fork PR) and 11 third-party actions
referenced by mutable tag.

**Fix** — `d3bdf85`: `.github/workflows/workflows.yml` runs actionlint (via the
Docker image, which bundles shellcheck - a bare binary silently skips shell
checks) and zizmor with `.github/zizmor.yml`, and every finding is fixed.

## RC7 — the AI SDK prompt-injection warning

**Mechanism.** `src/session/summary.ts` and `src/agent/agent.ts` passed the
system prompt as a `{ role: 'system' }` entry inside `messages:`/`prompt:`. AI
SDK v6 warns on that shape because a system message reaching the model through
the same channel as user content is a prompt-injection vector.

**Fix** — `8ddfd1b`: move the system entries into the `system:` option.
`js/tests/ai-sdk-warnings.ts` pins both directions - the old shape still warns,
the new one does not.

## RC8 — CRLF warnings on Windows

`js/tests/simulate-fresh-merge.js` creates throwaway git repositories; with
git's Windows defaults each commit printed `LF will be replaced by CRLF`
(8 occurrences per run).
**Fix** — `8ddfd1b`: a `configureRepository()` helper that sets
`core.autocrlf=false` (and the bot identity) on every fixture repository.

## RC9 — link rot

A local lychee run over the tree found 868 links and 50 errors. Excluding
`docs/case-studies` (as both templates do) left 13 `TOOLS.md` links still
pointing at the pre-rename `tests/*.tools.test.js` paths and four moved
groq/openrouter documentation URLs.
**Fix** — `7a9f209`, plus the workflow that keeps it from recurring.

## RC10 — historical: Rust `Auto Release` exit code 3

`CRATE_NAME=$(grep -Po '(?<=^name = ")[^"]*' rust/Cargo.toml)` matched three
`name =` lines (package, `[lib]`, `[[bin]]`), producing a multi-line variable
and a malformed crates.io URL; `curl` exits 3 for a malformed URL and `bash -e`
killed the step with no message (`ci-logs/run-28688932169-failed.log:600-670`).
Already fixed on `main` (`.github/workflows/rust.yml:272-334`: a dedicated
`crate` step output and `|| echo "000"` around the probe). Recorded here
because the issue asks for *all* errors, including the ones already closed.

## RC11 — Dependency Review failed for a repository setting, not a dependency

The first Security workflow run on this branch
(`33597326784`, Dependency Review job) failed with

```text
##[error]Dependency review is not supported on this repository. Please ensure
that Dependency graph is enabled, see .../settings/security_analysis
```

`actions/dependency-review-action` reads
`GET /repos/{owner}/{repo}/dependency-graph/compare/{base}...{head}` and turns a
403/404 from it into a hard failure. Confirmed independently:

```console
$ gh api repos/link-assistant/agent/dependency-graph/compare/main...issue-301-ef35bbf03fb8
{"message":"Forbidden", ... "status":"403"}
$ gh api repos/link-assistant/agent/dependency-graph/sbom
{"message":"Not Found", ... "status":"404"}
```

So the dependency graph is off for this repository, and no workflow change can
turn it on - it is a repository/organization setting. Left as-is, the job would
have marked **every** pull request red for a reason unrelated to its
dependencies: a textbook false positive of the kind this issue is about.
**Fix** — `9e5131f`: the job probes the same API first, skips the review with a
`::warning::` on 403/404, and still fails on any other unexpected status and on
every real advisory. `npm audit` and `cargo audit` keep covering the lockfiles
meanwhile. Enabling the dependency graph in the repository settings restores the
full check with no further code change.
