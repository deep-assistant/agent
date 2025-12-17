---
'@link-assistant/agent': patch
---

fix: Fixed `agent --version` command and added logging in `--verbose` mode

- Fixed `--version` command that was showing "unknown" instead of the current package version
- Added explicit import of `package.json` using `createRequire` with fallback via `fs`
- Added logging of version, command, working directory and script path in `--verbose` mode
