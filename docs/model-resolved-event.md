# `model_resolved` — machine-readable model routing

Every run emits exactly one `model_resolved` event on stdout, right after the CLI
decides which provider and model it will use and before any request reaches a
provider. It is the supported way to verify routing programmatically.

```json
{
  "type": "model_resolved",
  "timestamp": "2026-08-11T00:12:31.320Z",
  "requested": "formalai/formal-ai",
  "selector": "formalai/formal-ai",
  "providerID": "formalai",
  "modelID": "formal-ai",
  "source": "cli",
  "matchesRequest": true
}
```

## Fields

| Field           | Type             | Meaning                                                                                                                                  |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | `"model_resolved"` | Stable discriminator. Consumers switch on it; it is never reworded.                                                                      |
| `timestamp`     | string           | ISO 8601 time the model was resolved.                                                                                                     |
| `requested`     | string \| null   | Raw `--model`/`-m` value, or `null` when no model was requested.                                                                          |
| `selector`      | string           | The selector actually applied — `requested`, or the effective default when nothing was requested.                                         |
| `providerID`    | string           | Provider the run will talk to.                                                                                                            |
| `modelID`       | string           | Model the run will use.                                                                                                                   |
| `source`        | `"cli"` \| `"config"` \| `"default"` | `cli`: from `--model`/`-m`. `config`: an operator default (`LINK_ASSISTANT_AGENT_DEFAULT_MODEL`). `default`: the built-in default model. |
| `matchesRequest` | boolean         | Whether `providerID`/`modelID` satisfies `selector`. A qualified selector (`provider/model`) must match both parts; a bare selector only names the model, so the provider is free. |

`matchesRequest: false` means the run is about to use a model other than the one
that was selected — today the only in-tree path that does this is
`--use-existing-claude-oauth`, which substitutes `claude-oauth/claude-sonnet-4-5`
for the default model.

## Ordering guarantees

- Emitted **once per run**, on every resolution path: explicit `provider/model`,
  bare model id, and default.
- Emitted **before the first `step_start`** (`init` in the Claude standard).
- Emitted **before the first upstream HTTP request**, so a supervisor can kill
  the run before it can talk to a provider it did not ask for.

Under `--json-standard claude` (`--output-format stream-json`) the event is
always printed compact, on a single line, so the NDJSON stream stays valid. The
resolved model is also reported on that standard's `init` event as
`"model": "<providerID>/<modelID>"`.

## Why not parse the log message?

The CLI also logs `{"type":"log","message":"using explicit provider/model",...}`.
That record still exists and is unchanged, but its `message` is human-readable
prose: matching on it means an ordinary reword upstream silently disables a
downstream check. `model_resolved` is the contract; the log line is not.

## Example: fail the run when routing does not match

```bash
echo "hi" | agent --model formalai/formal-ai --output-format stream-json \
  | while read -r line; do
      case "$(jq -r 'select(.type == "model_resolved") | .matchesRequest' <<<"$line")" in
        false) echo "refusing: agent routed to an unrequested model" >&2; exit 1 ;;
      esac
      echo "$line"
    done
```

See [`examples/verify-model-routing.mjs`](../examples/verify-model-routing.mjs)
for a supervisor that does the same thing in JavaScript.

@see https://github.com/link-assistant/agent/issues/295
