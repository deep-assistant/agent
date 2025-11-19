# agent-cli

A minimal AI CLI agent MVP based on OpenCode, providing JSON input/output with unrestricted file and system access.

## Design Choices

### Why Bun.sh + JavaScript instead of TypeScript?

For this MVP, we chose **Bun.sh + JavaScript** over TypeScript for the following reasons:

1. **Faster Development**: No compilation step - direct execution with `bun run`
2. **Simpler Dependencies**: Fewer dev dependencies, no TypeScript compiler overhead
3. **MVP Focus**: Type safety is less critical for a proof-of-concept than rapid iteration
4. **Bun Ecosystem**: Leverages Bun's native ESM support and fast runtime
5. **Minimalism**: Aligns with the project's goal of being the "slimmest possible AI CLI agent"

If the project grows and requires type safety, TypeScript can be reintroduced later.

### Architecture: Reproducing OpenCode's JSON Event Streaming

This agent-cli reproduces the core architecture of [OpenCode](https://github.com/sst/opencode)'s `run --format json` command:

- **Streaming JSON Events**: Instead of single responses, outputs real-time event stream
- **Event Types**: `tool_use`, `text`, `step_start`, `step_finish`, `error`
- **Session Management**: Each request gets a unique session ID
- **Tool Execution**: Supports bash, read, edit, list, glob, grep tools with unrestricted access
- **Compatible Format**: Events match OpenCode's JSON schema for interoperability

The agent streams events as they occur, providing the same real-time experience as OpenCode's JSON mode.

## Features

- **JSON Input/Output**: Accepts JSON via stdin, outputs JSON responses
- **Unrestricted Access**: Full file system and command execution access
- **Tool Support**: Built-in tools for file operations, bash commands, and more
- **Hardcoded Model**: Uses OpenCode Zen Grok Code Fast 1 model
- **No TUI**: Pure CLI interface for automation and integration

## Installation

```bash
# Using bun (recommended)
bun install
bun link

# Or using npm
npm install -g .
```

## Usage

Pipe JSON input to the agent:

```bash
echo '{"message":"hello"}' | agent
```

### Input Format

```json
{
  "message": "Your message here",
  "tools": [
    {
      "name": "bash",
      "params": { "command": "ls -la" }
    }
  ]
}
```

### Output Format

```json
{
  "response": "Agent response",
  "model": "opencode/zen-grok-code-fast-1",
  "timestamp": 1234567890,
  "toolResults": [...]
}
```

## Supported Tools

All tools are fully tested with comprehensive reference tests in `test/reference/`:

- **`bash`**: Execute shell commands with output capture
- **`read`**: Read file contents with error handling
- **`edit`**: Edit file contents with string replacement
- **`list`**: List directory contents with metadata
- **`glob`**: Find files with glob patterns
- **`grep`**: Search text in files with line numbers

Each tool produces OpenCode-compatible JSON events with proper validation.

## Testing

Run tests with:

```bash
# Using bun (recommended)
bun test

# Or using npm
npm test
```

### Test Structure

- **`test/mvp.test.js`**: Basic functionality tests using command-stream
- **`test/reference/`**: Comprehensive reference tests for each supported tool
  - `bash.test.js` - Validates bash command execution
  - `read.test.js` - Validates file reading
  - `edit.test.js` - Validates file editing
  - `glob.test.js` - Validates file globbing
  - `grep.test.js` - Validates text searching
  - `list.test.js` - Validates directory listing

### Reference Tests ✅

Each reference test in `test/reference/` validates that agent-cli produces JSON output **100% compatible** with OpenCode's `run --format json` command. All tests pass:

- **`bash.test.js`** ✅ - Command execution with output capture
- **`read.test.js`** ✅ - File reading with content validation
- **`edit.test.js`** ✅ - File editing with string replacement
- **`glob.test.js`** ✅ - File globbing with pattern matching
- **`grep.test.js`** ✅ - Text searching with line numbers and matches
- **`list.test.js`** ✅ - Directory listing with metadata

**Test Features:**
- Document the expected OpenCode JSON event structure
- Validate complete JSON schema compliance
- Ensure proper event sequencing (step_start → tool_use → step_finish → text)
- Verify tool-specific output formats
- Use isolated temp files to prevent test interference
- Comprehensive error handling and cleanup

The `reference.test.json` file contains sample expected JSON event formats for documentation.

## Architecture Comparison

| Feature | OpenCode | agent-cli |
|---------|----------|-----------|
| JSON Event Streaming | ✅ `run --format json` | ✅ Streaming events |
| Tool Support | ✅ Full MCP + built-ins | ✅ bash, read, edit, list, glob, grep |
| Session Management | ✅ Session IDs | ✅ Unique session IDs |
| Real-time Events | ✅ tool_use, text, step_* | ✅ tool_use, text, step_* |
| Unrestricted Access | ✅ Full system access | ✅ Full system access |
| JSON Input | ✅ Via stdin piping | ✅ Via stdin piping |
| Model Support | ✅ Multiple providers | ✅ Hardcoded OpenCode Zen Grok Code Fast 1 |

## License

Unlicense (Public Domain)
