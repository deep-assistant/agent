#!/usr/bin/env bun

import { Server } from './server/server.ts'
import { Instance } from './project/instance.ts'
import { Log } from './util/log.ts'
import { Bus } from './bus/index.ts'
import { EOL } from 'os'

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.on('data', chunk => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data)
    })
    process.stdin.on('error', reject)
  })
}

async function main() {
  try {
    // Initialize logging to redirect to log file instead of stderr
    // This prevents log messages from mixing with JSON output
    await Log.init({
      print: false,  // Don't print to stderr
      level: 'INFO'
    })

    // Read input from stdin
    const input = await readStdin()
    const trimmedInput = input.trim()

    // Try to parse as JSON, if it fails treat it as plain text message
    let request
    try {
      request = JSON.parse(trimmedInput)
    } catch (e) {
      // Not JSON, treat as plain text message
      request = {
        message: trimmedInput
      }
    }

    // Wrap in Instance.provide for OpenCode infrastructure
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        // Start server like OpenCode does
        const server = Server.listen({ port: 0, hostname: "127.0.0.1" })

        try {
          // Create a session
          const createRes = await fetch(`http://${server.hostname}:${server.port}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
          const session = await createRes.json()
          const sessionID = session.id

          if (!sessionID) {
            throw new Error("Failed to create session")
          }

          // Subscribe to all bus events to output them in OpenCode format
          const eventPromise = new Promise((resolve, reject) => {
            const unsub = Bus.subscribeAll((event) => {
              // Output events in OpenCode JSON format
              if (event.type === 'message.part.updated') {
                const part = event.properties.part
                if (part.sessionID !== sessionID) return

                // Output different event types (pretty-printed for readability)
                if (part.type === 'step-start') {
                  process.stdout.write(JSON.stringify({
                    type: 'step_start',
                    timestamp: Date.now(),
                    sessionID,
                    part
                  }, null, 2) + EOL)
                }

                if (part.type === 'step-finish') {
                  process.stdout.write(JSON.stringify({
                    type: 'step_finish',
                    timestamp: Date.now(),
                    sessionID,
                    part
                  }, null, 2) + EOL)
                }

                if (part.type === 'text' && part.time?.end) {
                  process.stdout.write(JSON.stringify({
                    type: 'text',
                    timestamp: Date.now(),
                    sessionID,
                    part
                  }, null, 2) + EOL)
                }

                if (part.type === 'tool' && part.state.status === 'completed') {
                  process.stdout.write(JSON.stringify({
                    type: 'tool_use',
                    timestamp: Date.now(),
                    sessionID,
                    part
                  }, null, 2) + EOL)
                }
              }

              // Handle session idle to know when to stop
              if (event.type === 'session.idle' && event.properties.sessionID === sessionID) {
                unsub()
                resolve()
              }

              // Handle errors
              if (event.type === 'session.error') {
                const props = event.properties
                if (props.sessionID !== sessionID || !props.error) return
                process.stdout.write(JSON.stringify({
                  type: 'error',
                  timestamp: Date.now(),
                  sessionID,
                  error: props.error
                }, null, 2) + EOL)
              }
            })
          })

          // Send message to session with Grok Code Fast 1 model (opencode/grok-code)
          const message = request.message || "hi"
          const parts = [{ type: "text", text: message }]

          // Start the prompt (don't wait for response, events come via Bus)
          fetch(`http://${server.hostname}:${server.port}/session/${sessionID}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parts,
              model: {
                providerID: "opencode",
                modelID: "grok-code"
              }
            })
          }).catch(() => {
            // Ignore errors, we're listening to events
          })

          // Wait for session to become idle
          await eventPromise

          // Stop server
          server.stop()
        } catch (error) {
          server.stop()
          throw error
        }
      }
    })

    // Explicitly exit to ensure process terminates
    process.exit(0)
  } catch (error) {
    console.error(JSON.stringify({
      type: 'error',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    }))
    process.exit(1)
  }
}

main()
