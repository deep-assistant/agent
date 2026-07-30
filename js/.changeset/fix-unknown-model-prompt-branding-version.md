---
'@link-assistant/agent': patch
---

Fix three defects that made a session's behaviour unattributable (#285):

- Unknown model ids no longer silently fall back to the without-todo prompt.
  Prompt selection is now table-driven with an explicit, logged default
  (`anthropic`, which includes the todo/task-tracking discipline). Models that
  genuinely break on todo tools can opt out via `AGENT_SYSTEM_PROMPT`.
- The product identity (name, repo, issues and docs URLs) lives in one module
  and is substituted into prompts and tool descriptions at render time, so the
  agent no longer tells users it is `opencode` or sends bug reports to
  `sst/opencode`.
- Session records report the real package version instead of the hard-coded
  `agent-cli-1.0.0`; `--version`, the process log and session records now all
  read the same value.
