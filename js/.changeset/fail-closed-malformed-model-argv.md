---
'@link-assistant/agent': patch
---

fix: fail closed when a detected `--model` flag cannot be parsed

Malformed invocations that place `--model`, its value, and other flags in one
argv element now emit a structured `ModelResolutionError` and exit non-zero
before provider resolution or network access. The default model is never used
as a substitute for an unparseable caller-supplied model.
