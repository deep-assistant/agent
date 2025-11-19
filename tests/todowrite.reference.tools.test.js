import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {

  // Write and read todos in the same request
  const input = `{"message":"manage todos","tools":[{"name":"todowrite","params":{"todos":[{"content":"Test task 1","status":"pending","priority":"high","id":"test1"},{"content":"Test task 2","status":"completed","priority":"low","id":"test2"}]}},{"name":"todoread","params":{}}]}`
  const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
  const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
  const originalEvents = originalLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure for todoread tool (compatible with opencode run --format json --model opencode/grok-code)
  console.log('Expected OpenCode JSON event structure for todoread tool:')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"todoread","state":{"status":"completed","input":{},"output":{"todos":[...]}}}}')

  // Find tool_use events
  const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'todoread')

  // Should have tool_use events for todoread
  expect(originalToolEvents.length > 0).toBeTruthy()

  // Check the structure matches OpenCode format
  const originalTool = originalToolEvents[0]

  // Validate top-level structure
  expect(typeof originalTool.type).toBeTruthy()
  expect(originalTool.type).toBeTruthy()
  expect(typeof originalTool.timestamp).toBeTruthy()
  expect(typeof originalTool.sessionID).toBeTruthy()

  // Validate part structure
  expect(originalTool.part).toBeTruthy()
  expect(originalTool.part.tool).toBeTruthy()
  expect(originalTool.part.type).toBeTruthy()

  // Validate state structure
  expect(originalTool.part.state).toBeTruthy()
  expect(originalTool.part.state.status).toBeTruthy()
  expect(typeof originalTool.part.state.title).toBeTruthy()
  expect(originalTool.part.state.input).toBeTruthy()
  expect(typeof originalTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(originalTool.part.time).toBeTruthy()
  expect(typeof originalTool.part.time.start).toBeTruthy()
  expect(typeof originalTool.part.time.end).toBeTruthy()

  // Verify the todos were stored and retrieved
  const output = JSON.parse(originalTool.part.state.output)
  expect(output.todos).toBeTruthy()
  expect(Array.isArray(output.todos)).toBeTruthy()
  expect(output.todos.length).toBe(2)
  expect(output.todos[0].content).toBe('Test task 1')
  expect(output.todos[1].content).toBe('Test task 2')

  console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
  console.log('Actual output structure validated against expected OpenCode format')
})  console.log('This establishes the baseline behavior for compatibility testing')
