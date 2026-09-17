import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

/**
 * docs-list-context plugin for OpenCode
 *
 * Advertises project docs once per session without injecting their full catalog.
 */
export const DocsListContextPlugin: Plugin = async ({ directory }) => {
  const docsDir = join(directory, "docs")
  const hasDocsFolder = existsSync(docsDir)
  const injectedSessions = new Set<string>()

  return {
    "experimental.chat.system.transform": async ({ sessionID }, output) => {
      if (injectedSessions.has(sessionID)) {
        return
      }
      if (hasDocsFolder) {
        output.system.push(
          "Project docs detected. Before substantial work, use docs-ops or run the project docs-list command and read only relevant entries."
        )
      }
      injectedSessions.add(sessionID)
    }
  }
}

export default DocsListContextPlugin
