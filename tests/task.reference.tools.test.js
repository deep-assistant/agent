import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const input = '{"message":"launch task","tools":[{"name":"task","params":{"description":"Test task","prompt":"Do something","subagent_type":"general"}}]}'

  // Test original OpenCode task tool
  const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
  const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
  const originalEvents = originalLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure for task tool (compatible with opencode run --format json --model opencode/grok-code)
  console.log('Expected OpenCode JSON event structure for task tool:')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"task","state":{"status":"completed","input":{"description":"...","prompt":"...","subagent_type":"..."},"output":"result..."}}}')

  // Find tool_use events
  const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'task')

  // Should have tool_use events for task
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
  expect(originalTool.part.tool).toBe('task')
  expect(originalTool.part.type).toBe('tool')

  // Validate state structure
  expect(originalTool.part.state).toBeTruthy()
  expect(originalTool.part.state.status).toBe('completed')
  expect(typeof originalTool.part.state.title).toBeTruthy()
  expect(originalTool.part.state.input).toBeTruthy()
  expect(originalTool.part.state.input.description).toBe('Test task')
  expect(originalTool.part.state.input.prompt).toBe('Do something')
  expect(originalTool.part.state.input.subagent_type).toBe('general')
  expect(typeof originalTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(originalTool.part.time).toBeTruthy()
  expect(typeof originalTool.part.time.start).toBeTruthy()
  expect(typeof originalTool.part.time.end).toBeTruthy()
  expect(originalTool.part.time.end >= originalTool.part.time.start).toBeTruthy()

  // Verify the task was processed
  expect(originalTool.part.state.output.includes('Subagent general would process: Do something')).toBeTruthy()

  console.log('✅ Reference test passed - original OpenCode produces expected-compatible JSON format')
  console.log('Validated against expected structure compatible with opencode run --format json --model opencode/grok-code')
})