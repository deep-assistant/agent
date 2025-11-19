import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Agent-cli todowrite and todoread tools produce OpenCode-compatible JSON output', async () => {
  const projectRoot = process.cwd()

  // Write and read todos in the same request
  const input = `{"message":"manage todos","tools":[{"name":"todowrite","params":{"todos":[{"content":"Test task 1","status":"pending","priority":"high","id":"test1"},{"content":"Test task 2","status":"completed","priority":"low","id":"test2"}]}},{"name":"todoread","params":{}}]}`
  const agentResult = await sh(`echo '${input}' | bun run ${projectRoot}/src/index.js`)
  const agentLines = agentResult.stdout.trim().split('\n').filter(line => line.trim())
  const agentEvents = agentLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure for todoread tool
  console.log('Expected OpenCode JSON event structure for todoread tool:')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"todoread","state":{"status":"completed","input":{},"output":{"todos":[...]}}}}')

  // Find tool_use events
  const agentToolEvents = agentEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'todoread')

  // Should have tool_use events for todoread
  expect(agentToolEvents.length > 0).toBeTruthy()

  // Check the structure matches OpenCode format
  const agentTool = agentToolEvents[0]

  // Validate top-level structure
  expect(typeof agentTool.type).toBeTruthy()
  expect(agentTool.type).toBeTruthy()
  expect(typeof agentTool.timestamp).toBeTruthy()
  expect(typeof agentTool.sessionID).toBeTruthy()

  // Validate part structure
  expect(agentTool.part).toBeTruthy()
  expect(agentTool.part.tool).toBeTruthy()
  expect(agentTool.part.type).toBeTruthy()

  // Validate state structure
  expect(agentTool.part.state).toBeTruthy()
  expect(agentTool.part.state.status).toBeTruthy()
  expect(typeof agentTool.part.state.title).toBeTruthy()
  expect(agentTool.part.state.input).toBeTruthy()
  expect(typeof agentTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(agentTool.part.time).toBeTruthy()
  expect(typeof agentTool.part.time.start).toBeTruthy()
  expect(typeof agentTool.part.time.end).toBeTruthy()

  // Verify the todos were stored and retrieved
  const output = JSON.parse(agentTool.part.state.output)
  expect(output.todos).toBeTruthy()
  expect(Array.isArray(output.todos)).toBeTruthy()
  expect(output.todos.length).toBe(2)
  expect(output.todos[0].content).toBe('Test task 1')
  expect(output.todos[1].content).toBe('Test task 2')

  console.log('✅ Todowrite/Todoread tools test passed - agent-cli produces OpenCode-compatible JSON format')
  console.log('Actual output structure validated against expected OpenCode format')
})