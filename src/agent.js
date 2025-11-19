// @ts-ignore
import { $, sh } from 'command-stream'
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { glob } from 'glob'

export class Agent {
  constructor() {
    this.model = "opencode/zen-grok-code-fast-1"
    this.sessionID = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async process(request) {
    const message = request.message || "hi"
    const sessionID = this.sessionID

    // Emit initial step_start for the entire request
    this.emitEvent('step_start', {
      part: {
        sessionID,
        type: 'step-start',
        step: 'process_request'
      }
    })

    // Execute tools if provided
    if (request.tools && Array.isArray(request.tools)) {
      for (const tool of request.tools) {
        // Emit step_start event for tool
        this.emitEvent('step_start', {
          part: {
            sessionID,
            type: 'step-start',
            step: `execute_${tool.name}`
          }
        })

        try {
          const startTime = Date.now()
          const result = await this.executeTool(tool.name, tool.params)
          const endTime = Date.now()

          // Emit tool_use event
          this.emitEvent('tool_use', {
            part: {
              sessionID,
              type: 'tool',
              tool: tool.name,
              state: {
                status: 'completed',
                title: this.getToolTitle(tool.name, tool.params),
                input: tool.params,
                output: result.stdout || result.content || JSON.stringify(result)
              },
              time: {
                start: startTime,
                end: endTime
              }
            }
          })

          // Emit step_finish event for tool
          this.emitEvent('step_finish', {
            part: {
              sessionID,
              type: 'step-finish',
              step: `execute_${tool.name}`,
              reason: 'tool-calls'
            }
          })

        } catch (error) {
          // Emit error event
          this.emitEvent('error', {
            error: {
              name: 'ToolExecutionError',
              message: error instanceof Error ? error.message : String(error)
            }
          })

          // Emit step_finish event even on error
          this.emitEvent('step_finish', {
            part: {
              sessionID,
              type: 'step-finish',
              step: `execute_${tool.name}`,
              reason: 'error'
            }
          })
        }
      }
    }

    // Emit step_start for text generation
    this.emitEvent('step_start', {
      part: {
        sessionID,
        type: 'step-start',
        step: 'generate_response'
      }
    })

    // Emit text response
    const response = `Hello! You said: "${message}"`
    const textStartTime = Date.now()
    this.emitEvent('text', {
      part: {
        sessionID,
        type: 'text',
        text: response,
        time: {
          start: textStartTime,
          end: textStartTime
        }
      }
    })

    // Emit step_finish for text generation
    this.emitEvent('step_finish', {
      part: {
        sessionID,
        type: 'step-finish',
        step: 'generate_response',
        reason: 'stop'
      }
    })

    // Emit final step_finish for the entire request
    this.emitEvent('step_finish', {
      part: {
        sessionID,
        type: 'step-finish',
        step: 'process_request',
        reason: 'stop'
      }
    })

    // Return final result (for compatibility)
    return {
      response,
      model: this.model,
      timestamp: Date.now(),
      sessionID
    }
  }

  emitEvent(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      sessionID: this.sessionID,
      ...data
    }
    console.log(JSON.stringify(event))
  }

  getToolTitle(toolName, params) {
    switch (toolName) {
      case 'bash':
        return params.command || 'bash command'
      case 'read':
        return `read ${params.filePath}`
      case 'edit':
        return `edit ${params.filePath}`
      case 'list':
        return `list ${params.path || '.'}`
      case 'glob':
        return `glob ${params.pattern}`
      case 'grep':
        return `grep ${params.pattern}`
      default:
        return `${toolName} ${JSON.stringify(params)}`
    }
  }

  async executeTool(toolName, params) {
    switch (toolName) {
      case 'bash':
        // Use command-stream for bash execution with captured output
        const result = await sh(params.command, { mirror: false })
        return { stdout: result.stdout, stderr: result.stderr, code: result.code }

      case 'read':
        // Read file content
        try {
          const content = readFileSync(params.filePath, 'utf-8')
          return { content }
        } catch (error) {
          throw new Error(`Failed to read file ${params.filePath}: ${error}`)
        }

      case 'edit':
        // Edit file content
        try {
          let content = readFileSync(params.filePath, 'utf-8')
          if (params.oldString && params.newString !== undefined) {
            // Replace specific string
            if (!content.includes(params.oldString)) {
              throw new Error('oldString not found in file')
            }
            content = content.replace(params.oldString, params.newString)
          } else if (params.newString !== undefined) {
            // Replace entire file
            content = params.newString
          }
          writeFileSync(params.filePath, content, 'utf-8')
          return { success: true }
        } catch (error) {
          throw new Error(`Failed to edit file ${params.filePath}: ${error}`)
        }

      case 'list':
        // List directory contents
        try {
          const items = readdirSync(params.path || '.')
          const detailed = items.map(item => {
            const fullPath = join(params.path || '.', item)
            const stats = statSync(fullPath)
            return {
              name: item,
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modified: stats.mtime
            }
          })
          return { items: detailed }
        } catch (error) {
          throw new Error(`Failed to list directory ${params.path}: ${error}`)
        }

      case 'glob':
        // Find files with glob pattern
        try {
          const matches = await glob(params.pattern, {
            cwd: params.path || '.',
            absolute: true
          })
          return { matches }
        } catch (error) {
          throw new Error(`Failed to glob pattern ${params.pattern}: ${error}`)
        }

      case 'grep':
        // Search for patterns in files
        try {
          const matches = []
          const files = await glob(params.include || '**/*', {
            cwd: params.path || '.',
            absolute: true
          })

          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8')
              const lines = content.split('\n')
              lines.forEach((line, index) => {
                if (line.includes(params.pattern)) {
                  matches.push({
                    file,
                    line: index + 1,
                    content: line
                  })
                }
              })
            } catch (e) {
              // Skip files that can't be read
            }
          }
          return { matches }
        } catch (error) {
          throw new Error(`Failed to grep pattern ${params.pattern}: ${error}`)
        }

      case 'webfetch':
        // Simple web fetch (placeholder - would need fetch implementation)
        throw new Error('webfetch not implemented in MVP')

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }
}