---
'@link-assistant/agent': patch
---

fix: share Git objects and prune orphaned snapshot stores

Snapshot repositories now use the source repository's object database through
Git alternates instead of duplicating unchanged objects. Old snapshot stores
whose recorded worktrees no longer exist are removed with their related session
records, while the newest, recent, and live stores remain protected.
