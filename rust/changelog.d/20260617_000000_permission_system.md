---
bump: minor
---

### Added

- Added a `permission` module mirroring the JavaScript permission system (issue #271): `Mode` (`auto`/`plan`/`readonly`/`ask`), `Action` (`allow`/`ask`/`deny`), `Policy`, mode/override resolution, the read-only shell allowlist, structured bash evaluation, and the `permission_request` / `permission_response` JSON schemas.
- Added `--permission-mode` (env `LINK_ASSISTANT_AGENT_PERMISSION_MODE`) and `--permission` (env `LINK_ASSISTANT_AGENT_PERMISSION`) CLI flags. The default mode is `auto`, so behavior is unchanged. Invalid modes or `--permission` JSON now fail fast with a clear error.
