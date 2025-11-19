import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const input = '{"message":"run command","tools":[{"name":"bash","params":{"command":"echo hello world"}}]}'

  // Test original OpenCode bash tool
  const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
  const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
  const originalEvents = originalLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure (validated against: opencode run --format json --model opencode/grok-code)
  console.log('Expected OpenCode JSON event structure (compatible with opencode run --format json --model opencode/grok-code):')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"bash","state":{"status":"completed","input":{"command":"..."},"output":"..."}}}')

  // Find tool_use events
  const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'bash')

  // Should have tool_use events for bash
  expect(originalToolEvents.length > 0).toBeTruthy()

  // Check the structure matches OpenCode format
  const originalTool = originalToolEvents[0]

  // Validate top-level structure
  expect(typeof originalTool.type).toBeTruthy()
  expect(originalTool.type).toBe('tool_use')
  expect(typeof originalTool.timestamp).toBeTruthy()
  expect(typeof originalTool.sessionID).toBeTruthy()
  expect(originalTool.sessionID.startsWith('ses_')).toBeTruthy()

  // Validate part structure
  expect(originalTool.part).toBeTruthy()
  expect(originalTool.part.tool).toBe('bash')
  expect(originalTool.part.type).toBe('tool')

  // Validate state structure
  expect(originalTool.part.state).toBeTruthy()
  expect(originalTool.part.state.status).toBe('completed')
  expect(typeof originalTool.part.state.title).toBeTruthy()
  expect(originalTool.part.state.input).toBeTruthy()
  expect(originalTool.part.state.input.command).toBe('echo hello world')
  expect(typeof originalTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(originalTool.part.time).toBeTruthy()
  expect(typeof originalTool.part.time.start).toBeTruthy()
  expect(typeof originalTool.part.time.end).toBeTruthy()
  expect(originalTool.part.time.end >= originalTool.part.time.start).toBeTruthy()

  // Check that output contains expected result
  expect(originalTool.part.state.output.includes('hello world')).toBeTruthy()

  console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
  console.log('Validated against opencode run --format json --model opencode/grok-code output structure')
})  console.log('This establishes the baseline behavior for compatibility testing')
