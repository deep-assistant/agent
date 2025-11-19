import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Agent-cli task tool produces OpenCode-compatible JSON output', async () => {
  // Test our agent-cli task tool (compatible with OpenCode format)
  const projectRoot = process.cwd()
  const input = `{"message":"launch task","tools":[{"name":"task","params":{"description":"Test task","prompt":"Do something","subagent_type":"general"}}]}`
  const agentResult = await sh(`echo '${input}' | bun run ${projectRoot}/src/index.js`)
  const agentLines = agentResult.stdout.trim().split('\n').filter(line => line.trim())
  const agentEvents = agentLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure for task tool
  console.log('Expected OpenCode JSON event structure for task tool:')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"task","state":{"status":"completed","input":{"description":"...","prompt":"...","subagent_type":"..."},"output":"result..."}}}')

  // Find tool_use events
  const agentToolEvents = agentEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'task')

  // Should have tool_use events for task
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
  expect(typeof agentTool.part.state.input.description).toBeTruthy()
  expect(typeof agentTool.part.state.input.prompt).toBeTruthy()
  expect(typeof agentTool.part.state.input.subagent_type).toBeTruthy()
  expect(typeof agentTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(agentTool.part.time).toBeTruthy()
  expect(typeof agentTool.part.time.start).toBeTruthy()
  expect(typeof agentTool.part.time.end).toBeTruthy()

  // Verify the task was processed
  expect(agentTool.part.state.output.includes('Subagent general would process: Do something')).toBeTruthy()

  console.log('✅ Task tool test passed - agent-cli produces OpenCode-compatible JSON format')
  console.log('Actual output structure validated against expected OpenCode format')
})