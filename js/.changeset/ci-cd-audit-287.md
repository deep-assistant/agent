---
'@link-assistant/agent': patch
---

Fix false positives, false negatives, warnings and errors in CI/CD (#287):

- Release gating: the verbose HTTP logging integration test no longer asserts a provider-side HTTP 200, so a rate limit (429) or provider outage no longer marks the repository broken and blocks a release.
- npm publish verification no longer races the registry, and `js/package.json` packaging metadata is corrected.
- Test-coverage reporting counted only 4 of 52 test files.
- Lint and format checks now cover the shared `scripts/` helpers, and the pre-commit hook checks the same files CI does.
- All workflows declare a least-privilege top-level `permissions:` block, a `concurrency:` group, and per-job `timeout-minutes`.
- Job conditions use `!cancelled()` instead of `always()`, so cancelling a run stops dependent jobs.
- `workflow_dispatch` inputs and `github.head_ref` are passed through `env:` instead of being interpolated into shell scripts.
- `bun test` runs with a per-test timeout so a hung test reports before the job timeout.

Adds `js/tests/workflow-policy.js` and `js/tests/verbose-http-log.js` to keep these regressions from returning.
