---
'@link-assistant/agent': minor
---

feat: emit `model_resolved`, a machine-readable model routing event

Every run now emits exactly one `model_resolved` event on stdout — on every
resolution path (`--model provider/model`, `--model <bare id>`, and the default)
— immediately after the model is resolved and before the first `step_start` and
the first upstream request. It reports `requested`, `selector`, `providerID`,
`modelID`, `source` (`cli` | `config` | `default`) and `matchesRequest`, so a
caller can verify routing without matching the human-readable
`using explicit provider/model` log message, which is unchanged.

The Claude stream-json standard now also reports the resolved model on its `init`
event as `"model": "<providerID>/<modelID>"`.
