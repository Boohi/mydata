import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

function cleanText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim()
  }
  if (value == null) {
    return ""
  }
  return String(value).trim()
}

function normalizeError(value: unknown): string {
  const text = cleanText(value)
  if (!text) {
    return ""
  }
  const firstLine = text.split("\n")[0] || text
  return firstLine.slice(0, 220)
}

function collectFiles(input: any): string[] {
  const args = input?.args ?? input?.input ?? input?.tool_input ?? {}
  const files = new Set<string>()

  const add = (value: unknown) => {
    const text = cleanText(value)
    if (text) {
      files.add(text)
    }
  }

  add(args.file_path)
  add(args.filePath)
  add(args.path)

  if (Array.isArray(args.edits)) {
    for (const edit of args.edits) {
      add(edit?.file_path)
      add(edit?.filePath)
      add(edit?.path)
    }
  }

  if (Array.isArray(args.files)) {
    for (const file of args.files) {
      add(file)
    }
  }

  return Array.from(files).slice(0, 50)
}

export const ContinuousMemoryPlugin: Plugin = async ({ $, directory, client }) => {
  const contextScript = join(directory, ".ai-scripts", "memory-context.sh")
  const engineScript = join(directory, ".ai-scripts", "memory", "engine.mjs")

  const hasContextScript = existsSync(contextScript)
  const hasEngineScript = existsSync(engineScript)

  const injectedSessions = new Set<string>()
  const capturedToolStates = new Set<string>()
  let activeSessionID = "opencode-default"

  const logDebug = async (message: string, extra: Record<string, unknown> = {}) => {
    await client.app.log({
      service: "continuous-memory",
      level: "debug",
      message,
      extra,
    })
  }

  const appendEvent = async (event: {
    sessionID: string
    tool: string
    args: any
    status: "success" | "failure"
    error?: unknown
  }) => {
    if (!hasEngineScript) {
      return
    }

    const tool = cleanText(event.tool) || "unknown"
    const eventSessionID = cleanText(event.sessionID) || activeSessionID
    const files = collectFiles({ args: event.args })
    const status = event.status === "failure" ? "failure" : "success"
    const error = status === "failure" ? normalizeError(event.error) : ""

    try {
      await $`node ${engineScript} event --project ${directory} --source opencode --session ${eventSessionID} --tool ${tool} --status ${status} --error ${error} --files ${files.join(",")}`.text()
    } catch {
      await logDebug("Failed to append OpenCode memory event", {
        reason: "memory-capture-rejected-or-unavailable",
        status,
      })
    }
  }

  return {
    event: async ({ event }) => {
      const rawEvent = event as any
      if (event.type === "session.created") {
        const rawSessionId = rawEvent.properties?.info?.id
        const parsed = cleanText(rawSessionId)
        if (parsed) {
          activeSessionID = parsed
        }
      }

      if (event.type === "message.part.updated") {
        const part = rawEvent.properties?.part
        const state = part?.state
        if (part?.type === "tool" && (state?.status === "completed" || state?.status === "error")) {
          const captureKey = `${part.sessionID}:${part.callID}:${state.status}`
          if (capturedToolStates.has(captureKey)) return
          capturedToolStates.add(captureKey)
          await appendEvent({
            sessionID: part.sessionID,
            tool: part.tool,
            args: state.input,
            status: state.status === "error" ? "failure" : "success",
            error: state.status === "error" ? state.error : "",
          })
        }
      }

      if (event.type === "session.idle") {
        if (!hasEngineScript) {
          return
        }

        const endedSessionID = cleanText(rawEvent.properties?.sessionID) || activeSessionID

        try {
          await $`node ${engineScript} finalize --project ${directory} --source opencode --session ${endedSessionID}`.text()
        } catch {
          await logDebug("Failed to finalize OpenCode session memory", {
            reason: "memory-finalize-rejected-or-unavailable",
          })
        }
        for (const captureKey of capturedToolStates) {
          if (captureKey.startsWith(`${endedSessionID}:`)) capturedToolStates.delete(captureKey)
        }
      }
    },
    "experimental.chat.system.transform": async ({ sessionID }, output) => {
      if (!hasContextScript) {
        return
      }

      const current = cleanText(sessionID) || activeSessionID
      if (current) {
        activeSessionID = current
      }

      if (injectedSessions.has(activeSessionID)) {
        return
      }

      try {
        const context = await $`bash ${contextScript} ${directory}`.text()
        const trimmed = context.trim()
        if (trimmed) {
          output.system.push(trimmed)
        }
      } catch {
        await logDebug("Could not prepare memory session context", {
          reason: "memory-context-unavailable",
        })
      }

      injectedSessions.add(activeSessionID)
    },
  }
}

export default ContinuousMemoryPlugin
