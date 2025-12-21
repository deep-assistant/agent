# Stdin Mode Documentation

This document describes the comprehensive stdin handling features added in Issue #76.

## Overview

The Agent CLI provides flexible stdin handling with support for:

- **Piped input** - Read from stdin when input is piped (`echo "hi" | agent`)
- **Direct prompts** - Use `-p`/`--prompt` flag to bypass stdin
- **TTY detection** - Show help when running in interactive terminal without input
- **Input queuing** - Queue and merge rapidly arriving input lines
- **Interactive mode** - Accept both JSON and plain text (default)
- **Non-interactive mode** - Accept only JSON input

## Quick Start

### Basic Usage

```bash
# Plain text input
echo "Hello, how are you?" | agent

# JSON input
echo '{"message":"Hello, how are you?"}' | agent

# Direct prompt (no stdin)
agent -p "Hello, how are you?"
```

### TTY Detection

When running `agent` without arguments in an interactive terminal (TTY), it immediately shows help instead of hanging:

```bash
# In terminal - shows help and exits
agent

# With piped input - works normally
echo "hi" | agent
```

## CLI Flags

### `-p, --prompt <text>`

Send a prompt directly without reading from stdin.

```bash
agent -p "What is 2+2?"
```

This is useful for:

- One-off queries
- Scripts where you don't want to pipe input
- Avoiding stdin buffering issues

### `--disable-stdin`

Explicitly disable stdin streaming. Requires `--prompt` or shows an error.

```bash
# This will show an error with a suggestion to use -p
agent --disable-stdin

# This works
agent --disable-stdin -p "Hello"
```

### `--stdin-stream-timeout <ms>`

Set a timeout in milliseconds for stdin reading. If no input is received within the timeout, the agent exits.

```bash
# Wait for input for 5 seconds
agent --stdin-stream-timeout 5000
```

**Default:** No timeout (wait indefinitely until EOF)

### `--interactive / --no-interactive`

Control whether plain text input is accepted.

```bash
# Default: accept both JSON and plain text
echo "Hello" | agent

# Only accept JSON input
echo '{"message":"Hello"}' | agent --no-interactive

# Plain text will be rejected in non-interactive mode
echo "Hello" | agent --no-interactive  # Error!
```

**Default:** Interactive mode is enabled (`--interactive`)

### `--auto-merge-queued-messages / --no-auto-merge-queued-messages`

Control whether rapidly arriving input lines are merged into a single message.

```bash
# Default: merge multi-line input into one message
printf 'Line 1\nLine 2\nLine 3' | agent

# Treat each line as a separate message
printf 'Line 1\nLine 2\nLine 3' | agent --no-auto-merge-queued-messages
```

**Default:** Auto-merge is enabled (`--auto-merge-queued-messages`)

### `--always-accept-stdin / --no-always-accept-stdin`

Control whether the agent keeps listening for input after processing each message.

```bash
# Default: continuous listening mode - keeps accepting input until EOF or Ctrl+C
echo '{"message":"hi"}' | agent

# Single-message mode - exit after first response (legacy behavior)
echo '{"message":"hi"}' | agent --no-always-accept-stdin
```

In continuous mode (default):

- The agent keeps the session alive between messages
- You can send multiple messages and they will be queued
- The agent maintains conversation context across messages
- Press Ctrl+C or send EOF to exit

**Default:** Always accept stdin is enabled (`--always-accept-stdin`)

### `--compact-json`

Output compact JSON (single line) instead of pretty-printed JSON.

```bash
# Default: pretty-printed JSON output
echo "hi" | agent

# Compact JSON for program-to-program communication
echo "hi" | agent --compact-json
```

Compact mode is useful for:

- Parsing output with tools like `jq`
- Reducing bandwidth in automated pipelines
- Machine-to-machine communication

**Default:** Pretty-printed JSON (compact-json is disabled)

## Input Formats

### Plain Text

Plain text input is automatically converted to a JSON message:

```bash
echo "Hello, world!" | agent
```

Internally becomes:

```json
{ "message": "Hello, world!" }
```

### JSON Object

JSON objects are passed through directly:

```bash
echo '{"message":"Hello","tools":[]}' | agent
```

### Multi-line Input

When auto-merge is enabled (default), multi-line input is merged:

```bash
printf 'First line\nSecond line\nThird line' | agent
```

Becomes a single message: "First line\nSecond line\nThird line"

## Status Messages

When entering stdin listening mode, the CLI outputs a JSON status message (now pretty-printed by default):

```json
{
  "type": "status",
  "mode": "stdin-stream",
  "message": "Agent CLI in continuous listening mode. Accepts JSON and plain text input.",
  "hint": "Press CTRL+C to exit. Use --help for options.",
  "acceptedFormats": ["JSON object with \"message\" field", "Plain text"],
  "options": {
    "interactive": true,
    "autoMergeQueuedMessages": true,
    "alwaysAcceptStdin": true,
    "compactJson": false
  }
}
```

This helps programmatic consumers understand the CLI's current mode.

With `--compact-json`, status messages are output as single-line JSON:

```text
{"type":"status","mode":"stdin-stream","message":"Agent CLI in continuous listening mode. Accepts JSON and plain text input.","hint":"Press CTRL+C to exit. Use --help for options.","acceptedFormats":["JSON object with \"message\" field","Plain text"],"options":{"interactive":true,"autoMergeQueuedMessages":true,"alwaysAcceptStdin":true,"compactJson":true}}
```

## Behavior Matrix

| Scenario                                      | Behavior                                      |
| --------------------------------------------- | --------------------------------------------- |
| `agent` in terminal (TTY)                     | Shows help, exits                             |
| `echo "hi" \| agent`                          | Continuous mode - waits for more input        |
| `echo '{"message":"hi"}' \| agent`            | Continuous mode - waits for more input        |
| `agent -p "hello"`                            | Processes prompt directly, exits              |
| `agent --disable-stdin`                       | Shows error, suggests -p                      |
| `agent --no-interactive` with plain text      | Rejects, shows error                          |
| `agent --no-interactive` with JSON            | Processes normally                            |
| `agent` with stdin open (non-TTY)             | Outputs status JSON, waits for input          |
| `echo "hi" \| agent --no-always-accept-stdin` | Single-message mode - exits after response    |
| `agent --compact-json`                        | All JSON output is single-line (NDJSON style) |

## Examples

### Programmatic Usage

```bash
# Send JSON from a file
cat request.json | agent

# Pipe output from another command
git diff | agent -p "Review these changes"

# Use in scripts
result=$(echo "Summarize: $(cat file.txt)" | agent)
```

### Non-Interactive Mode for Automation

When building automated pipelines, use `--no-interactive` to ensure only valid JSON is accepted:

```bash
#!/bin/bash
# automation-script.sh

json_request='{"message":"Process this data"}'
response=$(echo "$json_request" | agent --no-interactive 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "Success: $response"
else
  echo "Failed to process request"
fi
```

### Interactive Terminal with Prompt

When you want to quickly ask a question without piping:

```bash
agent -p "What is the capital of France?"
```

## Error Handling

### Invalid JSON in Non-Interactive Mode

```json
{
  "type": "error",
  "message": "Invalid JSON input. In non-interactive mode (--no-interactive), only JSON input is accepted.",
  "hint": "Use --interactive to accept plain text, or provide valid JSON: {\"message\": \"your text\"}"
}
```

### No Prompt with --disable-stdin

```json
{
  "type": "error",
  "message": "No prompt provided. Use -p/--prompt to specify a message, or remove --disable-stdin to read from stdin.",
  "hint": "Example: agent -p \"Hello, how are you?\""
}
```

## CLI Best Practices

This implementation follows CLI best practices from:

- [Command Line Interface Guidelines (clig.dev)](https://clig.dev/)
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46)
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)

Key principles:

1. **Never hang silently** - Always provide feedback
2. **Detect TTY** - Show help when running interactively without input
3. **Provide alternatives** - `-p` flag for non-piped usage
4. **Be explicit** - Status messages explain the current mode
