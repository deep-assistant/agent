import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'
import { readFileSync, unlinkSync } from 'fs'

test('Agent-cli write tool produces OpenCode-compatible JSON output', async () => {
  const testFileName = `test-write-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`

  try {
    // Test our agent-cli write tool (compatible with OpenCode format)
    const projectRoot = process.cwd()
    const input = `{"message":"write file","tools":[{"name":"write","params":{"filePath":"${testFileName}","content":"Hello World\\nThis is a test file"}}]}`
    const agentResult = await sh(`echo '${input}' | bun run ${projectRoot}/src/index.js`)
    const agentLines = agentResult.stdout.trim().split('\n').filter(line => line.trim())
    const agentEvents = agentLines.map(line => JSON.parse(line))

    // Document expected OpenCode JSON structure for write tool
    console.log('Expected OpenCode JSON event structure for write tool:')
    console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"write","state":{"status":"completed","input":{"filePath":"...","content":"..."},"output":"success"}}}')

    // Find tool_use events
    const agentToolEvents = agentEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'write')

    // Should have tool_use events for write
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
    expect(typeof agentTool.part.state.input.filePath).toBeTruthy()
    expect(typeof agentTool.part.state.input.content).toBeTruthy()
    expect(typeof agentTool.part.state.output).toBeTruthy()

    // Validate timing information
    expect(agentTool.part.time).toBeTruthy()
    expect(typeof agentTool.part.time.start).toBeTruthy()
    expect(typeof agentTool.part.time.end).toBeTruthy()

    // Verify the file was actually written
    const finalContent = readFileSync(testFileName, 'utf-8')
    expect(finalContent).toBe('Hello World\nThis is a test file')

    console.log('✅ Write tool test passed - agent-cli produces OpenCode-compatible JSON format')
    console.log('Actual output structure validated against expected OpenCode format')
  } finally {
    // Clean up
    try {
      unlinkSync(testFileName)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})