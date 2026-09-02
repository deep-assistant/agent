---
'@link-assistant/agent': patch
---

fix: share Git objects and prune orphaned snapshot stores

Snapshot repositories now use the source repository's object database through
Git alternates instead of duplicating unchanged objects. Old snapshot stores
whose recorded worktrees no longer exist are removed with their related session
records, while the newest, recent, and live stores remain protected.

fix(ci): audit the pipelines for false positives, false negatives and warnings

The published package no longer depends on `@actions/core`, `@actions/exec`,
`@actions/github` or the vulnerable `undici` they pulled in, and the release
scripts survive Node 24's CommonJS namespace shape instead of failing with
`$ is not a function`. CI additionally lints its own workflows, scans
dependencies, checks links, fails a run whose jobs were cancelled by a timeout,
and no longer emits the npm `allow-scripts`, Windows CRLF or AI SDK
prompt-injection warnings.
